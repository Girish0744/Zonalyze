from typing import Any, Dict, List

from app.schemas.dashboard import ModuleAnalysisResponse


def _level_from_score(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "moderate"
    return "low"


def analyze_competition(features: Dict[str, Any]) -> ModuleAnalysisResponse:
    """
    Builds a competition-focused interpretation from feature values.

    The current project does not use live competitor listings yet, so this
    module explains the estimated competition pressure produced by the
    feature builder. In Capstone II, this service can be upgraded to use OSM
    or business listing data without changing the frontend contract.
    """
    score = float(features.get("competition_score_0_100", 0))
    competitor_count = float(features.get("competitor_count_estimate", 0))
    competitor_density = float(features.get("competitor_density_per_10k", 0))
    market_index = float(features.get("market_base_index_0_100", 0))
    radius = float(features.get("radius_km", 0))

    signals: List[str] = []

    if competitor_count >= 25:
        signals.append(f"The system estimates about {competitor_count:.0f} relevant competitors inside the selected radius.")
    elif competitor_count >= 10:
        signals.append(f"The system estimates a moderate competitor count of about {competitor_count:.0f} inside the selected radius.")
    else:
        signals.append(f"The system estimates a lower competitor count of about {competitor_count:.0f} inside the selected radius.")

    if competitor_density >= 6:
        signals.append(f"Competitor density is high at {competitor_density:.2f} competitors per 10,000 people.")
    elif competitor_density >= 2.5:
        signals.append(f"Competitor density is moderate at {competitor_density:.2f} competitors per 10,000 people.")
    else:
        signals.append(f"Competitor density is manageable at {competitor_density:.2f} competitors per 10,000 people.")

    if market_index >= 70:
        signals.append("The municipality has a strong market base, which can attract both demand and competitors.")
    elif market_index < 40:
        signals.append("The municipality has a smaller market base, so competition may be lower but demand may also be limited.")

    level = _level_from_score(score)
    summary = (
        f"Competition pressure is {level} with a score of {score:.1f}/100. "
        f"This is estimated from competitor count, competitor density, market base, and the selected {radius:.0f} km radius."
    )

    return ModuleAnalysisResponse(
        score=round(score, 2),
        level=level,
        summary=summary,
        signals=signals,
        metrics={
            "competitor_count_estimate": round(competitor_count, 2),
            "competitor_density_per_10k": round(competitor_density, 3),
            "market_base_index": round(market_index, 2),
            "radius_km": round(radius, 2),
        },
    )
