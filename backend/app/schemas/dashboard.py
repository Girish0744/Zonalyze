from pydantic import BaseModel
from app.schemas.sensor_packet import SensorPacket


class MonitorStatus(BaseModel):
    name: str
    value: str
    indicator: str


class DashboardSummaryResponse(BaseModel):
    application_name: str
    project_phase: str
    selected_zone: str
    selected_business_type: str
    radius_km: float
    people_location_packet: SensorPacket
    competition_monitor: MonitorStatus
    revenue_monitor: MonitorStatus
    risk_monitor: MonitorStatus