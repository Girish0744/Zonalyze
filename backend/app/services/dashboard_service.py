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
from app.services.demand_service import analyze_demand
from app.services.explanation_service import build_prediction_explanation
from app.services.lease_cost_service import analyze_lease_cost
from app.services.people_location_service import get_people_location_packet


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

    predictor = get_predictor()
    prediction_result = predictor.predict(features)
    explanation = build_prediction_explanation(
        features=features,
        prediction_result=prediction_result,
    )
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
        project_phase="Capstone Prototype - ML + Modular Analysis",
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
    )
