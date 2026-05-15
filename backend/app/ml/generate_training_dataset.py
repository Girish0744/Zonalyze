"""
Step 18 - Zonalyze training dataset generator.

Run from the backend folder:
    python -m app.ml.generate_training_dataset --rows 50000

This generator uses the shared business subcategory catalog as the source of
business-type behaviour. Municipalities are loaded from existing census-derived
files under app/data. No hardcoded demo scenarios are generated.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = APP_DIR / "data"
GENERATED_DIR = DATA_DIR / "generated"
DEFAULT_OUTPUT_PATH = GENERATED_DIR / "zonalyze_training_dataset_v2.csv"
RANDOM_SEED = 42


@dataclass
class MunicipalityProfile:
    municipality_name: str
    population_2021: float
    population_density: float
    median_income: float
    median_age: float
    household_count: float
    employment_rate: float
    diversity_index: float
    students_pct: float
    families_pct: float
    retirees_pct: float
    immigrant_pct: float
    visible_minority_pct: float


def _clean_name(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text.replace("\ufeff", "").strip()


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float, np.integer, np.floating)):
        if pd.isna(value):
            return default
        return float(value)
    text = str(value).replace(",", "").replace("%", "").strip()
    if text in {"", "..", "x", "X", "F", "NA", "N/A", "nan", "None"}:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _find_col(columns: Iterable[str], candidates: Iterable[str]) -> Optional[str]:
    normalized = {c.lower().strip().replace(" ", "_"): c for c in columns}
    for candidate in candidates:
        key = candidate.lower().strip().replace(" ", "_")
        if key in normalized:
            return normalized[key]
    for c in columns:
        low = c.lower()
        if any(candidate.lower() in low for candidate in candidates):
            return c
    return None


def _load_business_catalog() -> List[Dict[str, Any]]:
    """Load business subcategory metadata from app/catalogs/business_subcategories.py."""
    try:
        from app.catalogs import business_subcategories as catalog
    except Exception as exc:
        raise RuntimeError(
            "Could not import app.catalogs.business_subcategories. "
            "Run this command from the backend folder and make sure Step 17 catalog files exist."
        ) from exc

    if hasattr(catalog, "get_business_subcategory_catalog"):
        raw = catalog.get_business_subcategory_catalog()
    elif hasattr(catalog, "BUSINESS_SUBCATEGORY_CATALOG"):
        raw = catalog.BUSINESS_SUBCATEGORY_CATALOG
    elif hasattr(catalog, "BUSINESS_SUBCATEGORIES"):
        raw = catalog.BUSINESS_SUBCATEGORIES
    else:
        raise RuntimeError(
            "Business catalog found, but no supported catalog object/function exists. "
            "Expected get_business_subcategory_catalog(), BUSINESS_SUBCATEGORY_CATALOG, or BUSINESS_SUBCATEGORIES."
        )

    if isinstance(raw, dict):
        items = []
        for name, cfg in raw.items():
            item = dict(cfg or {})
            item.setdefault("business_subcategory", name)
            items.append(item)
        return items

    if isinstance(raw, list):
        items = []
        for item in raw:
            if isinstance(item, str):
                items.append({"business_subcategory": item})
            elif isinstance(item, dict):
                if not item.get("business_subcategory") and item.get("name"):
                    item = {**item, "business_subcategory": item["name"]}
                items.append(dict(item))
        return items

    raise RuntimeError("Unsupported business catalog format.")


def _extract_range(config: Dict[str, Any], range_key: str, min_key: str, max_key: str, fallback: Tuple[float, float]) -> Tuple[float, float]:
    value = config.get(range_key)
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return float(value[0]), float(value[1])
    if isinstance(value, str) and "-" in value:
        left, right = value.split("-", 1)
        return _to_float(left, fallback[0]), _to_float(right, fallback[1])
    if min_key in config or max_key in config:
        return _to_float(config.get(min_key), fallback[0]), _to_float(config.get(max_key), fallback[1])
    return fallback


def _extract_float(config: Dict[str, Any], keys: List[str], fallback: float) -> float:
    for key in keys:
        if key in config and config[key] is not None:
            return _to_float(config[key], fallback)
    return fallback


def _catalog_record(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize one catalog item into numeric assumptions used by dataset generation.

    Supports both newer catalog keys:
        business_subcategory, business_group, average_ticket_size_range

    And existing Zonalyze catalog keys:
        subcategory, category, avg_ticket, space_sqft, base_capture_rate
    """

    name = (
        config.get("business_subcategory")
        or config.get("subcategory")
        or config.get("name")
    )

    if not name:
        raise ValueError(
            f"Business catalog entry missing business_subcategory/subcategory/name: {config}"
        )

    group = (
        config.get("business_group")
        or config.get("category")
        or "General Local Business"
    )

    avg_ticket_min, avg_ticket_max = _extract_range(
        config,
        "average_ticket_size_range",
        "average_ticket_size_min",
        "average_ticket_size_max",
        (8.0, 35.0),
    )

    # Support your current catalog key: avg_ticket
    if "avg_ticket" in config:
        avg_ticket = _to_float(config.get("avg_ticket"), 20.0)
        avg_ticket_min = avg_ticket * 0.75
        avg_ticket_max = avg_ticket * 1.25

    sqft_min, sqft_max = _extract_range(
        config,
        "space_requirement_sqft_range",
        "space_sqft_min",
        "space_sqft_max",
        (800.0, 2200.0),
    )

    # Support your current catalog key: space_sqft
    if "space_sqft" in config:
        sqft = _to_float(config.get("space_sqft"), 1500.0)
        sqft_min = sqft * 0.80
        sqft_max = sqft * 1.20

    base_capture_rate = _extract_float(
        config,
        ["target_customer_rate", "target_customer_rate_0_1", "base_capture_rate"],
        0.045,
    )

    monthly_staff_cost = _extract_float(
        config,
        ["monthly_staff_cost", "staff_cost_monthly"],
        9000.0,
    )

    monthly_utilities = _extract_float(
        config,
        ["monthly_utilities", "utilities_monthly"],
        1200.0,
    )

    gross_margin_pct = _extract_float(
        config,
        ["gross_margin_pct", "gross_margin", "margin_pct"],
        0.35,
    )

    return {
        "business_subcategory": str(name),
        "business_group": str(group),

        "average_ticket_size_min": avg_ticket_min,
        "average_ticket_size_max": avg_ticket_max,

        "space_sqft_min": sqft_min,
        "space_sqft_max": sqft_max,

        "lease_sensitivity": _extract_float(
            config,
            ["lease_sensitivity", "lease_sensitivity_0_1"],
            0.55,
        ),

        "competition_sensitivity": _extract_float(
            config,
            ["competition_sensitivity", "competition_sensitivity_0_1"],
            0.55,
        ),

        "demand_sensitivity": _extract_float(
            config,
            ["demand_sensitivity", "demand_sensitivity_0_1"],
            0.65,
        ),

        "target_customer_rate": base_capture_rate,

        "operating_cost_multiplier": _extract_float(
            config,
            ["operating_cost_multiplier"],
            1.0,
        ),

        "repeat_customer_factor": _extract_float(
            config,
            ["repeat_customer_factor"],
            1.0,
        ),

        # Extra values from your existing catalog.
        "monthly_staff_cost": monthly_staff_cost,
        "monthly_utilities": monthly_utilities,
        "gross_margin_pct": gross_margin_pct,

        "student_weight": _extract_float(config, ["student_weight"], 0.5),
        "young_adult_weight": _extract_float(config, ["young_adult_weight"], 0.7),
        "family_weight": _extract_float(config, ["family_weight"], 0.8),
        "senior_weight": _extract_float(config, ["senior_weight"], 0.5),
        "diversity_weight": _extract_float(config, ["diversity_weight"], 0.6),
        "immigrant_weight": _extract_float(config, ["immigrant_weight"], 0.6),
        "income_sensitivity": _extract_float(config, ["income_sensitivity"], 0.7),
        "density_sensitivity": _extract_float(config, ["density_sensitivity"], 0.7),
        "labour_fit_column": config.get("labour_fit_column"),
        "osm_tags": config.get("osm_tags", []),
    }


def _load_municipalities_from_census() -> List[MunicipalityProfile]:
    """Load municipality profiles from available census-derived CSV files.

    This intentionally does not hardcode municipality names. It scans app/data
    for CSV files and uses the first file with recognizable municipality and
    population columns.
    """
    csv_files = sorted(DATA_DIR.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(
            "No CSV files found under backend/app/data. Copy the census-derived data folder before generating training data."
        )

    for path in csv_files:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if df.empty:
            continue

        municipality_col = _find_col(
            df.columns,
            ["municipality_name", "municipality", "geo_name", "geographic_name", "name"],
        )
        population_col = _find_col(
            df.columns,
            ["population_2021", "population", "total_population", "pop_2021"],
        )
        if not municipality_col or not population_col:
            continue

        density_col = _find_col(df.columns, ["population_density", "density", "population_density_per_square_kilometre"])
        income_col = _find_col(df.columns, ["median_income", "median_household_income", "household_income"])
        age_col = _find_col(df.columns, ["median_age"])
        household_col = _find_col(df.columns, ["household_count", "private_households", "households"])
        employment_col = _find_col(df.columns, ["employment_rate", "employment"])
        diversity_col = _find_col(df.columns, ["diversity_index", "diversity"])
        students_col = _find_col(df.columns, ["students_pct", "student_pct", "youth_pct"])
        families_col = _find_col(df.columns, ["families_pct", "family_pct"])
        retirees_col = _find_col(df.columns, ["retirees_pct", "senior_pct", "seniors_pct"])
        immigrant_col = _find_col(df.columns, ["immigrant_pct", "immigrants_pct"])
        visible_minority_col = _find_col(df.columns, ["visible_minority_pct", "visible_minority"])

        profiles: List[MunicipalityProfile] = []
        for _, row in df.iterrows():
            name = _clean_name(row.get(municipality_col))
            population = _to_float(row.get(population_col), 0)
            if not name or population <= 0:
                continue

            density = _to_float(row.get(density_col), max(100.0, population / 50.0)) if density_col else max(100.0, population / 50.0)
            median_income = _to_float(row.get(income_col), 85000.0) if income_col else 85000.0
            median_age = _to_float(row.get(age_col), 39.0) if age_col else 39.0
            household_count = _to_float(row.get(household_col), population / 2.5) if household_col else population / 2.5
            employment_rate = _to_float(row.get(employment_col), 62.0) if employment_col else 62.0
            diversity_index = _to_float(row.get(diversity_col), 45.0) if diversity_col else 45.0
            students_pct = _to_float(row.get(students_col), 14.0) if students_col else max(6.0, min(28.0, 18.0 - abs(median_age - 32.0) * 0.25))
            families_pct = _to_float(row.get(families_col), 44.0) if families_col else max(25.0, min(60.0, 48.0 - abs(median_age - 38.0) * 0.35))
            retirees_pct = _to_float(row.get(retirees_col), 16.0) if retirees_col else max(6.0, min(30.0, 10.0 + max(0.0, median_age - 36.0) * 0.65))
            immigrant_pct = _to_float(row.get(immigrant_col), diversity_index * 0.45) if immigrant_col else diversity_index * 0.45
            visible_minority_pct = _to_float(row.get(visible_minority_col), diversity_index * 0.50) if visible_minority_col else diversity_index * 0.50

            profiles.append(
                MunicipalityProfile(
                    municipality_name=name,
                    population_2021=population,
                    population_density=density,
                    median_income=median_income,
                    median_age=median_age,
                    household_count=household_count,
                    employment_rate=employment_rate,
                    diversity_index=diversity_index,
                    students_pct=students_pct,
                    families_pct=families_pct,
                    retirees_pct=retirees_pct,
                    immigrant_pct=immigrant_pct,
                    visible_minority_pct=visible_minority_pct,
                )
            )

        if profiles:
            print(f"Loaded {len(profiles)} municipality profiles from {path}")
            return profiles

    raise RuntimeError(
        "Could not find a census-derived CSV with municipality and population columns under backend/app/data."
    )


def _bounded(value: float, low: float, high: float) -> float:
    return float(max(low, min(high, value)))


def _risk_class_from_score(score: float) -> str:
    if score < 48:
        return "low"
    if score < 70:
        return "medium"
    return "high"


def _sample_row(profile: MunicipalityProfile, business: Dict[str, Any], rng: np.random.Generator) -> Dict[str, Any]:
    radius_km = float(rng.choice([1, 2, 3, 4, 5, 6, 8, 10, 12]))
    radius_factor = math.sqrt(radius_km / 5.0)

    avg_ticket_size = float(rng.uniform(business["average_ticket_size_min"], business["average_ticket_size_max"]))
    estimated_space_sqft = float(rng.uniform(business["space_sqft_min"], business["space_sqft_max"]))

    reachable_population = _bounded(profile.population_2021 * min(1.0, (radius_km / 8.0) ** 1.22), 250.0, profile.population_2021)
    target_customer_rate = _bounded(
        rng.normal(business["target_customer_rate"], business["target_customer_rate"] * 0.20),
        0.005,
        0.20,
    )
    target_customer_pool = reachable_population * target_customer_rate * business["repeat_customer_factor"]

    income_index = _bounded((profile.median_income - 45000.0) / 85000.0 * 100.0, 10.0, 100.0)
    density_index = _bounded(math.log1p(profile.population_density) / math.log1p(6000.0) * 100.0, 5.0, 100.0)
    diversity_fit = _bounded(profile.diversity_index + rng.normal(0, 8), 0, 100)

    business_name = business["business_subcategory"].lower()
    demographic_fit = 50.0
    demographic_fit += profile.students_pct * (0.75 if any(k in business_name for k in ["coffee", "bubble", "tutoring", "pizza"]) else 0.20)
    demographic_fit += profile.families_pct * (0.55 if any(k in business_name for k in ["grocery", "daycare", "pharmacy", "dental"]) else 0.25)
    demographic_fit += profile.retirees_pct * (0.50 if any(k in business_name for k in ["pharmacy", "physiotherapy", "dental"]) else 0.10)
    demographic_fit += profile.diversity_index * (0.45 if any(k in business_name for k in ["indian", "chinese", "halal", "grocery"]) else 0.18)
    demographic_fit = _bounded(demographic_fit / 1.85 + rng.normal(0, 6), 5, 100)

    foot_traffic_proxy = _bounded(0.48 * density_index + 0.30 * income_index + 0.22 * profile.employment_rate + rng.normal(0, 10), 5, 100)
    transit_access_proxy = _bounded(0.60 * density_index + 0.25 * profile.employment_rate + rng.normal(0, 12), 5, 100)
    daytime_activity_index = _bounded(0.50 * density_index + 0.35 * profile.employment_rate + 0.15 * foot_traffic_proxy + rng.normal(0, 8), 5, 100)

    competitor_base = (reachable_population / 10000.0) * (0.65 + business["competition_sensitivity"])
    competitor_count = int(max(0, rng.poisson(max(0.2, competitor_base))))
    nearest_competitor_distance = _bounded(rng.gamma(1.8, 0.9) / max(0.35, radius_factor), 0.05, 15.0)
    competitor_density_per_10k = competitor_count / max(1.0, reachable_population / 10000.0)
    competition_pressure = _bounded(
        competitor_density_per_10k * 14.0 * business["competition_sensitivity"]
        + (20.0 / max(0.35, nearest_competitor_distance))
        + rng.normal(0, 8),
        0,
        100,
    )

    base_psf = 18 + (density_index * 0.28) + (income_index * 0.16) + rng.normal(0, 5)
    psf_year = _bounded(base_psf * (0.75 + business["lease_sensitivity"] * 0.65), 12, 85)
    median_monthly_lease = (psf_year * estimated_space_sqft) / 12.0
    lease_low = median_monthly_lease * rng.uniform(0.72, 0.88)
    lease_high = median_monthly_lease * rng.uniform(1.15, 1.45)
    rent_pressure = _bounded((psf_year / 75.0) * 100.0 + business["lease_sensitivity"] * 12 + rng.normal(0, 5), 0, 100)

    demand_pressure = _bounded(
        0.30 * demographic_fit
        + 0.25 * foot_traffic_proxy
        + 0.18 * daytime_activity_index
        + 0.15 * income_index
        + 0.12 * transit_access_proxy
        - 0.18 * competition_pressure * business["competition_sensitivity"]
        + rng.normal(0, 5),
        0,
        100,
    )

    expected_customers_per_day = _bounded(
    (target_customer_pool / 24.0)
    * (0.55 + demand_pressure / 90.0)
    * (1.15 - competition_pressure / 260.0)
    * rng.uniform(0.85, 1.25),
    2,
    2500,
    )
    
    operating_days_per_month = int(rng.choice([24, 26, 28, 30]))
    gross_revenue = expected_customers_per_day * operating_days_per_month * avg_ticket_size

    staff_cost = (4500 + estimated_space_sqft * 1.25 + expected_customers_per_day * 32) * business["operating_cost_multiplier"]
    utilities_cost = 600 + estimated_space_sqft * rng.uniform(0.25, 0.85)
    insurance_cost = rng.uniform(250, 900)
    marketing_cost = max(450, gross_revenue * rng.uniform(0.025, 0.075))
    inventory_or_supply_cost = gross_revenue * rng.uniform(0.22, 0.48)
    monthly_operating_cost = median_monthly_lease + staff_cost + utilities_cost + insurance_cost + marketing_cost + inventory_or_supply_cost
    monthly_net_revenue = gross_revenue - monthly_operating_cost

    lease_burden_ratio = median_monthly_lease / max(1.0, gross_revenue)
    profit_margin = monthly_net_revenue / max(1.0, gross_revenue)
    feasibility = _bounded(
        54
        + profit_margin * 70
        + demand_pressure * 0.28
        + income_index * 0.10
        - competition_pressure * 0.20
        - rent_pressure * 0.16
        - max(0, lease_burden_ratio - 0.15) * 130
        + rng.normal(0, 5),
        0,
        100,
    )


    profitability_signal = _bounded((profit_margin + 0.20) / 0.55 * 100.0, 0, 100)
    lease_burden_signal = _bounded(lease_burden_ratio / 0.45 * 100.0, 0, 100)
    negative_revenue_signal = _bounded(max(0.0, -monthly_net_revenue) / 40000.0 * 100.0, 0, 100)

    risk_score = _bounded(
        44
        + competition_pressure * 0.12
        + rent_pressure * 0.10
        + lease_burden_signal * 0.10
        + negative_revenue_signal * 0.10
        - demand_pressure * 0.18
        - profitability_signal * 0.26
        - feasibility * 0.18
        + rng.normal(0, 12),
        0,
        100,
    )

    return {
        "municipality_name": profile.municipality_name,
        "business_subcategory": business["business_subcategory"],
        "business_group": business["business_group"],
        "radius_km": radius_km,
        "population_2021": round(profile.population_2021, 2),
        "population_density": round(profile.population_density, 2),
        "median_income": round(profile.median_income, 2),
        "median_age": round(profile.median_age, 2),
        "household_count": round(profile.household_count, 2),
        "employment_rate": round(profile.employment_rate, 2),
        "diversity_index": round(profile.diversity_index, 2),
        "students_pct": round(profile.students_pct, 2),
        "families_pct": round(profile.families_pct, 2),
        "retirees_pct": round(profile.retirees_pct, 2),
        "immigrant_pct": round(profile.immigrant_pct, 2),
        "visible_minority_pct": round(profile.visible_minority_pct, 2),
        "average_ticket_size": round(avg_ticket_size, 2),
        "estimated_space_sqft": round(estimated_space_sqft, 2),
        "target_customer_rate": round(target_customer_rate, 5),
        "lease_sensitivity": round(business["lease_sensitivity"], 3),
        "competition_sensitivity": round(business["competition_sensitivity"], 3),
        "demand_sensitivity": round(business["demand_sensitivity"], 3),
        "reachable_population_estimate": round(reachable_population, 2),
        "target_customer_pool_estimate": round(target_customer_pool, 2),
        "demographic_fit_score": round(demographic_fit, 2),
        "foot_traffic_proxy_index": round(foot_traffic_proxy, 2),
        "transit_access_proxy_index": round(transit_access_proxy, 2),
        "daytime_activity_index": round(daytime_activity_index, 2),
        "competitor_count_same_type": competitor_count,
        "nearest_competitor_distance_km": round(nearest_competitor_distance, 3),
        "competitor_density_per_10k": round(competitor_density_per_10k, 3),
        "competition_score_0_100": round(competition_pressure, 2),
        "competition_pressure_index": round(competition_pressure, 2),
        "lease_cost_per_sqft_year": round(psf_year, 2),
        "low_monthly_lease_cost": round(lease_low, 2),
        "median_monthly_lease_cost": round(median_monthly_lease, 2),
        "high_monthly_lease_cost": round(lease_high, 2),
        "rent_pressure_index": round(rent_pressure, 2),
        "demand_pressure_index": round(demand_pressure, 2),
        "demand_score_0_100": round(demand_pressure, 2),
        "expected_customers_per_day": round(expected_customers_per_day, 2),
        "gross_revenue_monthly": round(gross_revenue, 2),
        "monthly_operating_cost_estimate": round(monthly_operating_cost, 2),
        "lease_burden_ratio": round(lease_burden_ratio, 4),
        "profit_margin_pct": round(profit_margin * 100.0, 2),
        "monthly_net_revenue": round(monthly_net_revenue, 2),
        "feasibility_score": round(feasibility, 2),
        "risk_score": round(risk_score, 2),
        "risk_class": _risk_class_from_score(risk_score),
    }


def generate_dataset(rows: int, output_path: Path = DEFAULT_OUTPUT_PATH) -> pd.DataFrame:
    random.seed(RANDOM_SEED)
    rng = np.random.default_rng(RANDOM_SEED)

    municipalities = _load_municipalities_from_census()
    catalog = [_catalog_record(item) for item in _load_business_catalog()]
    if not catalog:
        raise RuntimeError("Business subcategory catalog is empty.")

    generated_rows = []
    for _ in range(rows):
        profile = random.choice(municipalities)
        business = random.choice(catalog)
        generated_rows.append(_sample_row(profile, business, rng))

    df = pd.DataFrame(generated_rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    summary_path = output_path.with_suffix(".summary.json")
    summary = {
        "dataset_version": "v2_business_catalog_realism",
        "row_count": int(len(df)),
        "municipality_count": int(df["municipality_name"].nunique()),
        "business_subcategory_count": int(df["business_subcategory"].nunique()),
        "source_note": "Municipalities loaded from census-derived app/data files. Business assumptions loaded from app.catalogs.business_subcategories.",
        "label_note": "Targets remain simulation-generated prototype labels. They are improved for realism but are not observed real-world outcomes.",
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Generated dataset: {output_path}")
    print(json.dumps(summary, indent=2))
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Zonalyze training dataset v2.")
    parser.add_argument("--rows", type=int, default=50000, help="Number of rows to generate.")
    parser.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT_PATH), help="Output CSV path.")
    args = parser.parse_args()
    generate_dataset(rows=args.rows, output_path=Path(args.output))


if __name__ == "__main__":
    main()
