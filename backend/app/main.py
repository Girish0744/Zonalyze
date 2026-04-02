from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import APP_NAME, APP_VERSION
from app.services.message_bus_service import register_sensor
from app.sensors.people_location_sensor import PeopleLocationSensor

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Zonalyze backend for simulated business feasibility intelligence"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def startup_event():
    people_sensor = PeopleLocationSensor()
    register_sensor(
        sensor_type=people_sensor.sensor_type,
        device_name=people_sensor.device_name
    )