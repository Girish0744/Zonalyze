from sqlalchemy.orm import Session

from app.ml.predictor import get_predictor
from app.ml.scenario_feature_builder import build_prediction_features
from app.schemas.dashboard import (
    AnalysisBreakdownResponse,
    DashboardSummaryResponse,
    MLPredictionResponse,
    MonitorStatus,
)
from app.schemas.scenario import AnalyzeScenarioRequest
from app.services.competition_service import analyze_competition
from app.services.competition_data_service import apply_competition_observation_to_features, get_competition_observation
from app.services.credibility_service import build_prediction_credibility
from app.services.demand_service import analyze_demand
from app.services.demand_data_service import apply_demand_evidence_to_features, get_demand_evidence
from app.services.explanation_service import build_prediction_explanation
from app.services.lease_cost_service import analyze_lease_cost
from app.services.lease_cost_data_service import apply_lease_cost_evidence_to_features, get_lease_cost_evidence
from app.services.people_location_service import get_people_location_packet
from app.services.prediction_consistency_service import apply_prediction_consistency_guard
from app.services.recommendation_service import build_recommendation_decision


DEFAULT_MUNICIPALITY = "Kitchener"
DEFAULT_BUSINESS_SUBCATEGORY = "Indian Grocery Store"
DEFAULT_RADIUS_KM = 5


def get_dashboard_summary(db: Session) -> DashboardSummaryResponse:
    """
    Returns the default ML-backed dashboard state.

    This keeps the GET /dashboard-summary endpoint aligned with the newer
    municipality_name / business_subcategory request schema.
    """
    default_request = AnalyzeScenarioRequest(
        municipality_name=DEFAULT_MUNICIPALITY,
        business_subcategory=DEFAULT_BUSINESS_SUBCATEGORY,
        radius_km=DEFAULT_RADIUS_KM,
    )
    return analyze_scenario(request=default_request, db=db)


def analyze_scenario(request: AnalyzeScenarioRequest, db: Session) -> DashboardSummaryResponse:
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features["municipality_name"] = request.municipality_name

    # Step 9: replace the previous competition-only formula signal with the
    # best available competition observation catalog value. When no catalog row
    # exists, the service clearly marks the fallback as a proxy.
    features = apply_competition_observation_to_features(features)

    competition_evidence = get_competition_observation(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        population=float(features.get("population_2021", 0) or 0),
    )

    # Step 10: replace the previous single lease-cost estimate with a range-
    # based evidence object. The median value is fed back into the feature row
    # so ML predictions, explanations, and reports are all consistent.
    features = apply_lease_cost_evidence_to_features(
        features=features,
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )

    lease_cost_evidence = get_lease_cost_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )


    # Step 11: replace the previous formula-only demand score with a demand
    # evidence object. It still uses proxy signals for this phase, but the
    # method, credibility, and data gap are now explicit. The evidence-backed
    # demand pressure is fed into the model feature row.
    features = apply_demand_evidence_to_features(
        features=features,
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )

    demand_evidence = get_demand_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )

    predictor = get_predictor()
    raw_prediction_result = predictor.predict(features)
    prediction_result = apply_prediction_consistency_guard(
        prediction_result=raw_prediction_result,
        features=features,
    )

    explanation = build_prediction_explanation(
        features=features,
        prediction_result=prediction_result,
    )
    prediction_credibility = build_prediction_credibility(
        features=features,
        prediction_result=prediction_result,
    )

    recommendation_decision = build_recommendation_decision(
        features=features,
        prediction_result=prediction_result,
        credibility=prediction_credibility,
        competition_evidence=competition_evidence,
        lease_cost_evidence=lease_cost_evidence,
        demand_evidence=demand_evidence,
    )

    # Keep the legacy ml_prediction.recommendation field aligned with the new
    # recommendation decision layer so older frontend code still receives the
    # best available recommendation label.
    prediction_result = {
        **prediction_result,
        "recommendation": recommendation_decision.final_recommendation,
    }

    analysis_breakdown = AnalysisBreakdownResponse(
        demand_analysis=analyze_demand(features),
        competition_analysis=analyze_competition(features),
        lease_cost_analysis=analyze_lease_cost(
            features=features,
            prediction_result=prediction_result,
        ),
    )

    people_packet = get_people_location_packet(
        request=request,
        db=db,
    )

    predicted_revenue = prediction_result["predicted_monthly_net_revenue"]
    predicted_risk = prediction_result["predicted_risk_class"]
    competition_score = features["competition_score_0_100"]

    if competition_score < 35:
        competition_indicator = "green"
    elif competition_score < 65:
        competition_indicator = "yellow"
    else:
        competition_indicator = "red"

    if predicted_revenue > 0:
        revenue_indicator = "green"
    elif predicted_revenue > -10000:
        revenue_indicator = "yellow"
    else:
        revenue_indicator = "red"

    if predicted_risk == "low":
        risk_indicator = "green"
    elif predicted_risk == "medium":
        risk_indicator = "yellow"
    else:
        risk_indicator = "red"

    return DashboardSummaryResponse(
        application_name="Zonalyze",
        project_phase="Capstone Prototype - ML + Market Evidence Layer",
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        people_location_packet=people_packet,
        competition_monitor=MonitorStatus(
            name="Competition",
            value=f"{competition_score:.1f}/100 competition pressure",
            indicator=competition_indicator,
        ),
        revenue_monitor=MonitorStatus(
            name="Revenue",
            value=f"${predicted_revenue:,.0f} estimated monthly net revenue",
            indicator=revenue_indicator,
        ),
        risk_monitor=MonitorStatus(
            name="Investment Risk",
            value=f"{predicted_risk.title()} risk",
            indicator=risk_indicator,
        ),
        ml_prediction=MLPredictionResponse(**prediction_result),
        prediction_explanation=explanation,
        analysis_breakdown=analysis_breakdown,
        prediction_credibility=prediction_credibility,
        competition_evidence=competition_evidence,
        lease_cost_evidence=lease_cost_evidence,
        demand_evidence=demand_evidence,
        recommendation_decision=recommendation_decision,
    )
