from typing import Dict, List, Optional
from app.bus.bus_instance import message_bus
from app.schemas.sensor_packet import SensorPacket


def register_sensor(sensor_type: str, device_name: str) -> None:
    if not message_bus.is_registered(sensor_type):
        message_bus.register_sensor(sensor_type, device_name)


def publish_packet(packet: SensorPacket) -> None:
    message_bus.publish(packet)


def get_latest_packet(sensor_type: str) -> Optional[SensorPacket]:
    return message_bus.get_latest_packet(sensor_type)


def get_registered_sensors() -> Dict[str, str]:
    return message_bus.get_registered_sensors()


def get_packet_history(sensor_type: str) -> List[SensorPacket]:
    return message_bus.get_packet_history(sensor_type)