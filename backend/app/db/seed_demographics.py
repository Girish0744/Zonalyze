from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.demographics import DemographicZone


def seed_demographic_data():
    db: Session = SessionLocal()

    try:
        existing_count = db.query(DemographicZone).count()
        if existing_count > 0:
            print("Demographic data already exists. Skipping seed.")
            return

        rows = [
            DemographicZone(
                zone_name="Waterloo Region",
                min_radius_km=0.0,
                max_radius_km=2.0,
                base_population=5600,
                students_pct=68,
                families_pct=20,
                retirees_pct=12,
                summary_text="Compact urban zone with strong student concentration.",
                indicator="green",
            ),
            DemographicZone(
                zone_name="Waterloo Region",
                min_radius_km=2.0,
                max_radius_km=5.0,
                base_population=14200,
                students_pct=60,
                families_pct=27,
                retirees_pct=13,
                summary_text="Balanced population mix with strong commercial potential.",
                indicator="green",
            ),
            DemographicZone(
                zone_name="Waterloo Region",
                min_radius_km=5.0,
                max_radius_km=10.0,
                base_population=28500,
                students_pct=52,
                families_pct=33,
                retirees_pct=15,
                summary_text="Wider catchment area with broader demographic spread.",
                indicator="yellow",
            ),
            DemographicZone(
                zone_name="Waterloo Region",
                min_radius_km=10.0,
                max_radius_km=50.0,
                base_population=42000,
                students_pct=45,
                families_pct=37,
                retirees_pct=18,
                summary_text="Large regional catchment with diluted urban concentration.",
                indicator="yellow",
            ),
            DemographicZone(
                zone_name="Kitchener Downtown",
                min_radius_km=0.0,
                max_radius_km=2.0,
                base_population=6100,
                students_pct=54,
                families_pct=28,
                retirees_pct=18,
                summary_text="Dense downtown core with mixed residential-commercial activity.",
                indicator="green",
            ),
            DemographicZone(
                zone_name="Kitchener Downtown",
                min_radius_km=2.0,
                max_radius_km=5.0,
                base_population=15600,
                students_pct=48,
                families_pct=34,
                retirees_pct=18,
                summary_text="Urban mixed-use catchment with balanced demand potential.",
                indicator="green",
            ),
            DemographicZone(
                zone_name="Cambridge",
                min_radius_km=0.0,
                max_radius_km=2.0,
                base_population=4800,
                students_pct=30,
                families_pct=46,
                retirees_pct=24,
                summary_text="Smaller neighborhood catchment with stronger family presence.",
                indicator="green",
            ),
            DemographicZone(
                zone_name="Cambridge",
                min_radius_km=2.0,
                max_radius_km=5.0,
                base_population=13200,
                students_pct=28,
                families_pct=49,
                retirees_pct=23,
                summary_text="Family-oriented service area with stable suburban demand.",
                indicator="green",
            ),
        ]

        db.add_all(rows)
        db.commit()
        print("Demographic seed data inserted successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error while seeding demographic data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demographic_data()