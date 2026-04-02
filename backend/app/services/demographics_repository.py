from sqlalchemy.orm import Session
from app.models.demographics import DemographicZone


def find_matching_demographic_zone(
    db: Session,
    selected_zone: str,
    radius_km: float
):
    return (
        db.query(DemographicZone)
        .filter(DemographicZone.zone_name == selected_zone)
        .filter(DemographicZone.min_radius_km <= radius_km)
        .filter(DemographicZone.max_radius_km > radius_km)
        .first()
    )