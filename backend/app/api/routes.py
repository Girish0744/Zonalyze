from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.test_connection import test_database_connection
from app.db.dependencies import get_db
from app.services.dashboard_service import get_dashboard_summary, analyze_scenario
from app.services.message_bus_service import (
    get_registered_sensors,
    get_latest_packet,
    get_packet_history,
)
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.scenario import AnalyzeScenarioRequest
from app.schemas.bus import RegisteredSensorsResponse, PacketHistoryResponse
from app.schemas.sensor_packet import SensorPacket

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
    db: Session = Depends(get_db)
):
    return analyze_scenario(request, db)


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