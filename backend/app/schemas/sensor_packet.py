from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime


class MetricItem(BaseModel):
    key: str
    label: str
    value: float
    unit: str


class SensorPacket(BaseModel):
    timestamp: datetime
    device_name: str
    sensor_type: str
    selected_zone: str
    selected_business_type: str
    radius_km: float
    indicator: str
    summary_text: str
    metrics: List[MetricItem]
    meta: Dict[str, str] = {}