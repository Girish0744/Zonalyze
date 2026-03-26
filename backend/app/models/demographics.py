from sqlalchemy import Column, Integer, String, Float
from app.db.base import Base


class DemographicZone(Base):
    __tablename__ = "demographic_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String, nullable=False, index=True)
    min_radius_km = Column(Float, nullable=False)
    max_radius_km = Column(Float, nullable=False)

    base_population = Column(Integer, nullable=False)
    students_pct = Column(Float, nullable=False)
    families_pct = Column(Float, nullable=False)
    retirees_pct = Column(Float, nullable=False)

    summary_text = Column(String, nullable=False)
    indicator = Column(String, nullable=False)