from typing import Any, Dict, List

from app.schemas.dashboard import ModuleAnalysisResponse


def _level_from_burden(burden_pct: float) -> str:
    if burden_pct >= 30:
        return "high"
    if burden_pct >= 15:
        return "moderate"
    return "manageable"


def analyze_lease_cost(
    features: Dict[str, Any],
    prediction_result: Dict[str, Any],
) -> ModuleAnalysisResponse:
    """
    Builds a lease and operating-cost interpretation.

    The current system estimates lease cost from census-derived rent pressure,
    density, and business space requirements. This module turns those values
    into a user-facing cost analysis.
    """
    lease = float(features.get("monthly_lease_cost_estimate", 0))
    staff = float(features.get("monthly_staff_cost_estimate", 0))
    utilities = float(features.get("monthly_utilities_cost_estimate", 0))
    marketing = float(features.get("monthly_marketing_cost_estimate", 0))
    operating = float(features.get("monthly_operating_cost_estimate", 0))
    sqft = float(features.get("estimated_space_sqft", 0))
    rent_pressure = float(features.get("rent_pressure_index_0_100", 0))
    revenue = float(prediction_result.get("predicted_monthly_net_revenue", 0))

    gross_estimate = revenue + operating
    lease_burden_pct = (lease / gross_estimate * 100) if gross_estimate > 0 else 100.0
    score = min(100.0, max(0.0, lease_burden_pct * 2.2 + rent_pressure * 0.35))
    level = _level_from_burden(lease_burden_pct)

    signals: List[str] = []

    signals.append(f"Estimated monthly lease cost is ${lease:,.0f} for about {sqft:,.0f} sq. ft.")
    signals.append(f"Total monthly operating cost is estimated at ${operating:,.0f}, including staff, utilities, marketing, and overhead.")

    if lease_burden_pct >= 30:
        signals.append(f"Lease burden is high at about {lease_burden_pct:.1f}% of estimated gross revenue.")
    elif lease_burden_pct >= 15:
        signals.append(f"Lease burden is moderate at about {lease_burden_pct:.1f}% of estimated gross revenue.")
    else:
        signals.append(f"Lease burden is manageable at about {lease_burden_pct:.1f}% of estimated gross revenue.")

    if rent_pressure >= 70:
        signals.append("The municipality shows high rent pressure, so cost assumptions should be reviewed carefully.")
    elif rent_pressure < 40:
        signals.append("Rent pressure is comparatively lower, which supports better cost control.")

    summary = (
        f"Lease and cost pressure is {level}. The estimated lease is ${lease:,.0f}/month, "
        f"and the operating cost estimate is ${operating:,.0f}/month."
    )

    return ModuleAnalysisResponse(
        score=round(score, 2),
        level=level,
        summary=summary,
        signals=signals,
        metrics={
            "monthly_lease_cost_estimate": round(lease, 2),
            "monthly_staff_cost_estimate": round(staff, 2),
            "monthly_utilities_cost_estimate": round(utilities, 2),
            "monthly_marketing_cost_estimate": round(marketing, 2),
            "monthly_operating_cost_estimate": round(operating, 2),
            "estimated_space_sqft": round(sqft, 2),
            "lease_burden_pct": round(lease_burden_pct, 2),
            "rent_pressure_index": round(rent_pressure, 2),
        },
    )
