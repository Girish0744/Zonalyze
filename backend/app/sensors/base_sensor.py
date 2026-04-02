from abc import ABC, abstractmethod


class BaseSensor(ABC):
    def __init__(self, device_name: str, sensor_type: str):
        self.device_name = device_name
        self.sensor_type = sensor_type

    @abstractmethod
    def compute(self, *args, **kwargs):
        pass