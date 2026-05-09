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


@router.get("/validation/system", response_model=SystemValidationResponse)
def system_validation_route(db: Session = Depends(get_db)):
    return run_system_validation(db)


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
