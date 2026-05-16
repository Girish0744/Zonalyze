from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.test_connection import test_database_connection
from app.db.dependencies import get_db
from app.schemas.bus import RegisteredSensorsResponse, PacketHistoryResponse
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.report import FeasibilityReportResponse
from app.schemas.scenario import AnalyzeScenarioRequest
from app.schemas.validation import SystemValidationResponse
from app.schemas.model_status import ModelStatusResponse
from app.schemas.feature_alignment import FeatureAlignmentResponse
from app.schemas.dashboard import PredictionCredibilityResponse
from app.schemas.competition import CompetitionObservationCatalogResponse, CompetitionObservationEvidence
from app.schemas.lease import LeaseCostCatalogResponse, LeaseCostEvidence
from app.schemas.demand import DemandEvidenceCatalogResponse, DemandEvidence
from app.schemas.recommendation import RecommendationDecision
from app.schemas.scenario_history import ScenarioComparisonResponse, ScenarioHistoryItem, ScenarioHistoryResponse
from app.schemas.geospatial import GeospatialMarketContext
from app.schemas.sensor_packet import SensorPacket
from app.services.catalog_service import get_municipalities, get_business_subcategories
from app.services.dashboard_service import get_dashboard_summary, analyze_scenario
from app.services.message_bus_service import (
    get_registered_sensors,
    get_latest_packet,
    get_packet_history,
)
from app.services.report_service import build_feasibility_report
from app.services.validation_service import run_system_validation
from app.services.model_status_service import get_model_status
from app.services.feature_alignment_service import run_feature_alignment
from app.ml.scenario_feature_builder import build_prediction_features
from app.ml.predictor import get_predictor
from app.services.credibility_service import build_prediction_credibility
from app.services.competition_data_service import apply_competition_observation_to_features, get_competition_observation, list_competition_observations
from app.services.lease_cost_data_service import apply_lease_cost_evidence_to_features, get_lease_cost_evidence, list_lease_cost_observations
from app.services.demand_data_service import apply_demand_evidence_to_features, get_demand_evidence, list_demand_observations
from app.services.recommendation_service import build_recommendation_decision
from app.services.scenario_history_service import (
    clear_saved_scenarios,
    compare_saved_scenarios,
    list_saved_scenarios,
    save_dashboard_to_history,
)
from app.services.geospatial_service import build_geospatial_market_context
from app.services.osm_service import fetch_osm_competitors, fetch_osm_transit, fetch_osm_commercial_activity


router = APIRouter()


@router.get("/")
def root():
    return {
        "message": "Zonalyze backend is running"
    }


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "backend"
    }


@router.get("/db-check")
def db_check():
    success, message = test_database_connection()

    return {
        "database_connected": success,
        "message": message
    }


@router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)


@router.post("/analyze-scenario", response_model=DashboardSummaryResponse)
def analyze_scenario_route(
    request: AnalyzeScenarioRequest,
    db: Session = Depends(get_db),
):
    return analyze_scenario(request=request, db=db)


@router.post("/reports/feasibility", response_model=FeasibilityReportResponse)
def feasibility_report_route(
    request: AnalyzeScenarioRequest,
    db: Session = Depends(get_db),
):
    dashboard = analyze_scenario(request=request, db=db)
    return build_feasibility_report(dashboard)



@router.get("/ml/model-status", response_model=ModelStatusResponse)
def model_status_route():
    return get_model_status()


@router.get("/ml/feature-alignment", response_model=FeatureAlignmentResponse)
def feature_alignment_default_route():
    return run_feature_alignment()


@router.post("/ml/feature-alignment", response_model=FeatureAlignmentResponse)
def feature_alignment_route(request: AnalyzeScenarioRequest):
    return run_feature_alignment(request)


@router.post("/ml/prediction-credibility", response_model=PredictionCredibilityResponse)
def prediction_credibility_route(request: AnalyzeScenarioRequest):
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features["municipality_name"] = request.municipality_name
    features = apply_competition_observation_to_features(features)
    features = apply_lease_cost_evidence_to_features(
        features=features,
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features = apply_demand_evidence_to_features(
        features=features,
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    prediction_result = get_predictor().predict(features)
    return build_prediction_credibility(
        features=features,
        prediction_result=prediction_result,
    )


@router.post("/recommendation/decision", response_model=RecommendationDecision)
def recommendation_decision_route(request: AnalyzeScenarioRequest):
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features["municipality_name"] = request.municipality_name
    features = apply_competition_observation_to_features(features)
    competition_evidence = get_competition_observation(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        population=float(features.get("population_2021", 0) or 0),
    )
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
    prediction_result = get_predictor().predict(features)
    credibility = build_prediction_credibility(
        features=features,
        prediction_result=prediction_result,
    )
    return build_recommendation_decision(
        features=features,
        prediction_result=prediction_result,
        credibility=credibility,
        competition_evidence=competition_evidence,
        lease_cost_evidence=lease_cost_evidence,
        demand_evidence=demand_evidence,
    )


@router.get("/validation/system", response_model=SystemValidationResponse)
def system_validation_route(db: Session = Depends(get_db)):
    return run_system_validation(db)


@router.get("/market/competition-observations", response_model=CompetitionObservationCatalogResponse)
def competition_observations_route():
    observations = list_competition_observations()
    return CompetitionObservationCatalogResponse(
        count=len(observations),
        observations=observations,
    )


@router.post("/market/competition-evidence", response_model=CompetitionObservationEvidence | None)
def competition_evidence_route(request: AnalyzeScenarioRequest):
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    return get_competition_observation(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        population=float(features.get("population_2021", 0) or 0),
    )




@router.get("/market/lease-cost-observations", response_model=LeaseCostCatalogResponse)
def lease_cost_observations_route():
    observations = list_lease_cost_observations()
    return LeaseCostCatalogResponse(
        count=len(observations),
        observations=observations,
    )


@router.post("/market/lease-cost-evidence", response_model=LeaseCostEvidence)
def lease_cost_evidence_route(request: AnalyzeScenarioRequest):
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features["municipality_name"] = request.municipality_name
    return get_lease_cost_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )


@router.get("/market/demand-observations", response_model=DemandEvidenceCatalogResponse)
def demand_observations_route():
    observations = list_demand_observations()
    return DemandEvidenceCatalogResponse(
        count=len(observations),
        observations=observations,
    )


@router.post("/market/demand-evidence", response_model=DemandEvidence)
def demand_evidence_route(request: AnalyzeScenarioRequest):
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    features["municipality_name"] = request.municipality_name
    features = apply_competition_observation_to_features(features)
    features = apply_lease_cost_evidence_to_features(
        features=features,
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    return get_demand_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )




@router.post("/geo/market-map", response_model=GeospatialMarketContext)
def geospatial_market_map_route(request: AnalyzeScenarioRequest):
    return build_geospatial_market_context(request)




@router.post("/geo/osm-pois")
def osm_pois_route(request: AnalyzeScenarioRequest):
    from app.services.geospatial_service import _center_for_municipality

    center_lat, center_lng = _center_for_municipality(request.municipality_name)
    competitors = fetch_osm_competitors(
        business_subcategory=request.business_subcategory,
        center_lat=center_lat,
        center_lon=center_lng,
        radius_km=request.radius_km,
        limit=60,
    )
    transit = fetch_osm_transit(
        center_lat=center_lat,
        center_lon=center_lng,
        radius_km=request.radius_km,
        limit=30,
    )
    commercial = fetch_osm_commercial_activity(
        center_lat=center_lat,
        center_lon=center_lng,
        radius_km=request.radius_km,
        limit=20,
    )
    return {
        "municipality_name": request.municipality_name,
        "business_subcategory": request.business_subcategory,
        "radius_km": request.radius_km,
        "center": {"latitude": center_lat, "longitude": center_lng},
        "competitors": {"status": competitors.status, "note": competitors.note, "count": len(competitors.elements), "items": competitors.elements},
        "transit": {"status": transit.status, "note": transit.note, "count": len(transit.elements), "items": transit.elements},
        "commercial_activity": {"status": commercial.status, "note": commercial.note, "count": len(commercial.elements), "items": commercial.elements},
    }


@router.post("/scenario-history/save", response_model=ScenarioHistoryItem)
def save_scenario_history_route(
    request: AnalyzeScenarioRequest,
    db: Session = Depends(get_db),
):
    dashboard = analyze_scenario(request=request, db=db)
    return save_dashboard_to_history(dashboard, db)


@router.get("/scenario-history", response_model=ScenarioHistoryResponse)
def list_scenario_history_route(db: Session = Depends(get_db)):
    return list_saved_scenarios(db)


@router.delete("/scenario-history", response_model=ScenarioHistoryResponse)
def clear_scenario_history_route(db: Session = Depends(get_db)):
    return clear_saved_scenarios(db)


@router.post("/scenario-history/compare", response_model=ScenarioComparisonResponse)
def compare_scenario_history_route(db: Session = Depends(get_db)):
    return compare_saved_scenarios(db)


@router.get("/municipalities")
def municipalities_route():
    return {"municipalities": get_municipalities()}


@router.get("/business-subcategories")
def business_subcategories_route():
    return {"business_subcategories": get_business_subcategories()}


@router.get("/bus/registered-sensors", response_model=RegisteredSensorsResponse)
def bus_registered_sensors():
    return RegisteredSensorsResponse(
        sensors=get_registered_sensors()
    )


@router.get("/bus/latest/{sensor_type}", response_model=SensorPacket | None)
def bus_latest_packet(sensor_type: str):
    return get_latest_packet(sensor_type)


@router.get("/bus/history/{sensor_type}", response_model=PacketHistoryResponse)
def bus_packet_history(sensor_type: str):
    packets = get_packet_history(sensor_type)

    return PacketHistoryResponse(
        sensor_type=sensor_type,
        count=len(packets),
        packets=packets
    )
