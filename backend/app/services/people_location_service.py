from datetime import datetime
from sqlalchemy.orm import Session

from app.schemas.scenario import AnalyzeScenarioRequest
from app.schemas.sensor_packet import SensorPacket
from app.sensors.people_location_sensor import PeopleLocationSensor
from app.services.demographics_repository import find_matching_demographic_zone
from app.services.message_bus_service import publish_packet


def get_people_location_packet(
    request: AnalyzeScenarioRequest,
    db: Session
) -> SensorPacket:
    row = find_matching_demographic_zone(
        db=db,
        selected_zone=request.selected_zone,
        radius_km=request.radius_km
    )

    sensor = PeopleLocationSensor()

    if row is None:
        fallback_packet = SensorPacket(
            timestamp=datetime.utcnow(),
            device_name=sensor.device_name,
            sensor_type=sensor.sensor_type,
            selected_zone=request.selected_zone,
            selected_business_type=request.selected_business_type,
            radius_km=request.radius_km,
            indicator="red",
            summary_text="No demographic data available for the selected zone and radius.",
            metrics=[],
            meta={
                "data_source": "postgresql",
                "status": "missing"
            }
        )

        publish_packet(fallback_packet)
        return fallback_packet

    packet = sensor.compute(request, row)
    publish_packet(packet)
    return packet