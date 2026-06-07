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
from app.schemas.operating_profile import OperatingProfileRequest, OperatingProfileResponse
from app.services.operating_profile_service import build_operating_profile


DEFAULT_MUNICIPALITY = "Kitchener"
DEFAULT_BUSINESS_SUBCATEGORY = "Indian Grocery Store"
DEFAULT_RADIUS_KM = 5

def _operating_profile_section(profile: OperatingProfileResponse | None, key: str):
    if not profile:
        return None
    for section in profile.sections or []:
        if section.key == key:
            return section
    return None


def _profile_range_value(profile: OperatingProfileResponse | None, section_key: str, value_name: str = "median"):
    section = _operating_profile_section(profile, section_key)
    if not section or not section.range:
        return None
    value = getattr(section.range, value_name, None)
    try:
        if value is None:
            return None
        number = float(value)
        if number <= 0:
            return None
        return number
    except Exception:
        return None


def _build_dashboard_operating_profile(request: AnalyzeScenarioRequest) -> OperatingProfileResponse | None:
    """Build the operating profile inside the dashboard response.

    The operating profile is generated once by the backend and returned with the
    dashboard so the frontend does not display a separate, conflicting estimate.
    Failures do not block the ML dashboard; they are represented by the profile
    service's own ai_unavailable/unavailable response when possible.
    """
    try:
        return build_operating_profile(
            OperatingProfileRequest(
                municipality_name=request.municipality_name,
                business_subcategory=request.business_subcategory,
                radius_km=request.radius_km,
            )
        )
    except Exception:
        return None


def _apply_operating_profile_to_features(features: dict, operating_profile: OperatingProfileResponse | None) -> dict:
    """Align dashboard evidence fields with the operating profile where safe.

    This does not create hardcoded fallback values. It only uses values returned
    by the AI operating-profile service. It also avoids applying clearly invalid
    customer-economics values such as cents-per-customer for retail scenarios.
    """
    if not operating_profile or operating_profile.status not in {"estimated", "success"}:
        return features

    low_lease = _profile_range_value(operating_profile, "lease_cost", "low")
    median_lease = _profile_range_value(operating_profile, "lease_cost", "median")
    high_lease = _profile_range_value(operating_profile, "lease_cost", "high")
    median_space = _profile_range_value(operating_profile, "space_requirement", "median")
    median_staff = _profile_range_value(operating_profile, "staffing", "median")
    median_utilities_marketing = _profile_range_value(operating_profile, "utilities_marketing", "median")
    median_ticket = _profile_range_value(operating_profile, "customer_economics", "median")

    if median_space:
        features["estimated_space_sqft"] = median_space

    if median_lease:
        features["monthly_lease_cost_estimate"] = median_lease
        features["median_monthly_lease_cost"] = median_lease
        features["lease_cost_source_alignment"] = "operating_profile"
    if low_lease:
        features["lease_cost_low_estimate"] = low_lease
        features["low_monthly_lease_cost"] = low_lease
    if high_lease:
        features["lease_cost_high_estimate"] = high_lease
        features["high_monthly_lease_cost"] = high_lease

    if median_staff:
        features["monthly_staff_cost_estimate"] = median_staff

    # The operating profile section combines utilities and marketing. Store the
    # combined planning estimate separately and use it in the operating-cost
    # total so the displayed cost context stays aligned.
    if median_utilities_marketing:
        features["monthly_utilities_marketing_cost_estimate"] = median_utilities_marketing

    # Only apply average-ticket values that are plausible for retail/service
    # customer spend. This prevents weak local-model outputs such as $0.08/customer
    # from corrupting the prediction feature row.
    if median_ticket and 1.0 <= median_ticket <= 500.0:
        features["average_ticket_size"] = median_ticket

    operating_components = []
    for value in [median_lease, median_staff, median_utilities_marketing]:
        if value:
            operating_components.append(value)
    if operating_components:
        features["monthly_operating_cost_estimate"] = round(sum(operating_components), 2)

    return features


def _align_lease_evidence_with_operating_profile(lease_cost_evidence, operating_profile: OperatingProfileResponse | None):
    """Return lease evidence with lease range aligned to the operating profile.

    The original lease evidence object is preserved when the profile has no
    usable lease range. When a range exists, model_copy/copy is used so the
    object type remains compatible with the existing response schema.
    """
    if lease_cost_evidence is None or operating_profile is None:
        return lease_cost_evidence

    low_lease = _profile_range_value(operating_profile, "lease_cost", "low")
    median_lease = _profile_range_value(operating_profile, "lease_cost", "median")
    high_lease = _profile_range_value(operating_profile, "lease_cost", "high")
    median_space = _profile_range_value(operating_profile, "space_requirement", "median")

    if not median_lease:
        return lease_cost_evidence

    update = {
        "monthly_lease_cost_estimate": median_lease,
        "median_monthly_lease_cost": median_lease,
        "data_quality_note": (
            "Lease range aligned with the dashboard operating profile. "
            "The operating profile is an AI benchmark/evidence-assisted planning estimate, not a verified lease quote."
        ),
    }
    if low_lease:
        update["low_monthly_lease_cost"] = low_lease
        update["lease_cost_low_estimate"] = low_lease
    if high_lease:
        update["high_monthly_lease_cost"] = high_lease
        update["lease_cost_high_estimate"] = high_lease
    if median_space and median_space > 0:
        update["estimated_space_sqft"] = median_space
        update["lease_cost_per_sqft_year"] = round((median_lease * 12) / median_space, 2)

    try:
        if hasattr(lease_cost_evidence, "model_copy"):
            return lease_cost_evidence.model_copy(update=update)
        if hasattr(lease_cost_evidence, "copy"):
            return lease_cost_evidence.copy(update=update)
    except Exception:
        return lease_cost_evidence

    return lease_cost_evidence



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

    # Step 32B: generate the operating profile inside the dashboard flow and use
    # its usable values to keep dashboard evidence, explanations, and the profile
    # card aligned in one response.
    operating_profile = _build_dashboard_operating_profile(request)
    features = _apply_operating_profile_to_features(features, operating_profile)
    lease_cost_evidence = _align_lease_evidence_with_operating_profile(
        lease_cost_evidence=lease_cost_evidence,
        operating_profile=operating_profile,
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
        project_phase="Capstone Prototype - Trust-Aware Evidence Layer",
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        people_location_packet=people_packet,
        competition_monitor=MonitorStatus(
            name="Competition Pressure Estimate",
            value=f"{competition_score:.1f}/100 estimated competition pressure",
            indicator=competition_indicator,
        ),
        revenue_monitor=MonitorStatus(
            name="Prototype Revenue Estimate",
            value=f"${predicted_revenue:,.0f} prototype monthly net revenue estimate",
            indicator=revenue_indicator,
        ),
        risk_monitor=MonitorStatus(
            name="Prototype Risk Estimate",
            value=f"{predicted_risk.title()} prototype risk estimate",
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
