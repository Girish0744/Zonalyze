from typing import Any, Dict, List

from app.schemas.dashboard import ModuleAnalysisResponse


def _level_from_score(score: float) -> str:
    if score >= 70:
        return "strong"
    if score >= 45:
        return "moderate"
    return "weak"


def analyze_demand(features: Dict[str, Any]) -> ModuleAnalysisResponse:
    """
    Builds a demand-focused interpretation from the model feature row.

    This service does not replace the ML model. It gives the dashboard a
    dedicated demand analysis block so the user can understand customer
    potential before looking at revenue and risk.
    """
    score = float(features.get("demand_score_0_100", 0))
    demographic_fit = float(features.get("demographic_fit_score_0_100", 0))
    reachable_population = float(features.get("reachable_population_estimate", 0))
    population_density = float(features.get("population_density_per_km2", 0))
    median_income = float(features.get("household_median_total_income_2020", 0))
    avg_ticket = float(features.get("average_ticket_size", 0))

    signals: List[str] = []

    if reachable_population >= 50000:
        signals.append(f"The selected radius reaches a large pool of about {reachable_population:,.0f} people.")
    elif reachable_population >= 20000:
        signals.append(f"The selected radius reaches a medium pool of about {reachable_population:,.0f} people.")
    else:
        signals.append(f"The selected radius reaches a smaller pool of about {reachable_population:,.0f} people.")

    if demographic_fit >= 70:
        signals.append(f"The local demographic profile is a strong match for this business type at {demographic_fit:.1f}/100.")
    elif demographic_fit >= 45:
        signals.append(f"The demographic match is acceptable at {demographic_fit:.1f}/100.")
    else:
        signals.append(f"The demographic match is limited at {demographic_fit:.1f}/100.")

    if population_density >= 1000:
        signals.append("Population density is high enough to support walk-in or short-trip customer behavior.")
    elif population_density >= 250:
        signals.append("Population density is moderate, so demand depends more on local fit and accessibility.")
    else:
        signals.append("Population density is low, so the business may need a wider customer catchment area.")

    if median_income >= 90000:
        signals.append("Median household income is strong, which can support higher average spending.")
    elif median_income > 0 and median_income < 55000:
        signals.append("Median household income is lower, so pricing sensitivity may be higher.")

    level = _level_from_score(score)
    summary = (
        f"Demand is {level} for this scenario with a score of {score:.1f}/100. "
        f"The estimate is based on reachable population, demographic fit, density, income, and expected average ticket size of ${avg_ticket:,.0f}."
    )

    return ModuleAnalysisResponse(
        score=round(score, 2),
        level=level,
        summary=summary,
        signals=signals,
        metrics={
            "reachable_population_estimate": round(reachable_population, 2),
            "demographic_fit_score": round(demographic_fit, 2),
            "population_density_per_km2": round(population_density, 2),
            "median_income": round(median_income, 2),
            "average_ticket_size": round(avg_ticket, 2),
        },
    )
