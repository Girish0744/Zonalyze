from pydantic import BaseModel
from typing import Dict, List
from app.schemas.sensor_packet import SensorPacket


class RegisteredSensorsResponse(BaseModel):
    sensors: Dict[str, str]


class PacketHistoryResponse(BaseModel):
    sensor_type: str
    count: int
    packets: List[SensorPacket]