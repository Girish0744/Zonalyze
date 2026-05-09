from datetime import datetime
from typing import Iterable

from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.report import FeasibilityReportResponse


def _money(value: float | int | None) -> str:
    if value is None:
        return "Not available"
    return f"${value:,.0f}"


def _pct(value: float | int | None) -> str:
    if value is None:
        return "Not available"
    return f"{value:.1f}%"


def _score(value: float | int | None) -> str:
    if value is None:
        return "Not available"
    return f"{value:.1f}/100"


def _number(value: float | int | None, decimals: int = 0) -> str:
    if value is None:
        return "Not available"
    return f"{value:,.{decimals}f}"


def _lines(items: Iterable[str]) -> str:
    values = [item for item in items if item]
    if not values:
        return "Not available"
    return "\n".join(f"- {item}" for item in values)


def _metric_lookup(dashboard: DashboardSummaryResponse, key: str) -> float | None:
    for metric in dashboard.people_location_packet.metrics:
        if metric.key == key:
            return metric.value
    return None


def build_feasibility_report(dashboard: DashboardSummaryResponse) -> FeasibilityReportResponse:
    """
    Builds a downloadable plain-text feasibility report from the same backend
    response used by the cockpit dashboard.

    The report is intentionally text-based for this phase because it is stable,
    easy to test, and does not add PDF-generation dependencies to the backend.
    """
    ml = dashboard.ml_prediction
    explanation = dashboard.prediction_explanation
    breakdown = dashboard.analysis_breakdown

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    safe_city = dashboard.municipality_name.lower().replace(" ", "-")
    safe_business = dashboard.business_subcategory.lower().replace(" ", "-").replace("/", "-")
    filename = f"zonalyze-feasibility-report-{safe_city}-{safe_business}.txt"

    population_total = _metric_lookup(dashboard, "population_total")
    population_density = _metric_lookup(dashboard, "population_density_per_km2")
    median_income = _metric_lookup(dashboard, "median_total_income")
    diversity_index = _metric_lookup(dashboard, "diversity_index_0_100")
    students_pct = _metric_lookup(dashboard, "students_pct")
    families_pct = _metric_lookup(dashboard, "families_pct")
    retirees_pct = _metric_lookup(dashboard, "retirees_pct")

    report_text = f"""ZONALYZE FEASIBILITY REPORT
Generated: {generated_at}

SCENARIO
Municipality: {dashboard.municipality_name}
Business Subcategory: {dashboard.business_subcategory}
Search Radius: {dashboard.radius_km:.1f} km
Project Phase: {dashboard.project_phase}

EXECUTIVE SUMMARY
Recommendation: {ml.recommendation.replace('_', ' ').title() if ml else 'Not available'}
Predicted Risk Class: {ml.predicted_risk_class.title() if ml else 'Not available'}
Predicted Monthly Net Revenue: {_money(ml.predicted_monthly_net_revenue if ml else None)}
Predicted Feasibility Score: {_score(ml.predicted_feasibility_score if ml else None)}

CORE MONITORS
Competition: {dashboard.competition_monitor.value} [{dashboard.competition_monitor.indicator.upper()}]
Revenue: {dashboard.revenue_monitor.value} [{dashboard.revenue_monitor.indicator.upper()}]
Investment Risk: {dashboard.risk_monitor.value} [{dashboard.risk_monitor.indicator.upper()}]

DEMOGRAPHIC SNAPSHOT
Population Total: {_number(population_total)}
Population Density: {_number(population_density, 1)} people/km²
Median Income: {_money(median_income)}
Diversity Index: {_score(diversity_index)}
Youth/Student Share: {_pct(students_pct)}
Family Share: {_pct(families_pct)}
Senior/Retiree Share: {_pct(retirees_pct)}
People and Location Summary: {dashboard.people_location_packet.summary_text}

PREDICTION EXPLANATION
Revenue Explanation: {explanation.revenue_explanation if explanation else 'Not available'}
Risk Explanation: {explanation.risk_explanation if explanation else 'Not available'}
Feasibility Explanation: {explanation.feasibility_explanation if explanation else 'Not available'}

MODEL FACTORS
Competition Score: {_score(explanation.competition_score if explanation else None)}
Demand Score: {_score(explanation.demand_score if explanation else None)}
Demographic Fit Score: {_score(explanation.demographic_fit_score if explanation else None)}
Estimated Competitor Count: {explanation.estimated_competitor_count if explanation else 'Not available'}
Reachable Population Estimate: {_number(explanation.reachable_population_estimate if explanation else None)}
Monthly Lease Cost Estimate: {_money(explanation.monthly_lease_cost_estimate if explanation else None)}
Monthly Operating Cost Estimate: {_money(explanation.monthly_operating_cost_estimate if explanation else None)}

POSITIVE FACTORS
{_lines(explanation.top_positive_factors if explanation else [])}

NEGATIVE FACTORS
{_lines(explanation.top_negative_factors if explanation else [])}

MODULE BREAKDOWN
Demand Analysis: {breakdown.demand_analysis.summary if breakdown else 'Not available'}
Demand Score: {_score(breakdown.demand_analysis.score if breakdown else None)}
Demand Signals:
{_lines(breakdown.demand_analysis.signals if breakdown else [])}

Competition Analysis: {breakdown.competition_analysis.summary if breakdown else 'Not available'}
Competition Score: {_score(breakdown.competition_analysis.score if breakdown else None)}
Competition Signals:
{_lines(breakdown.competition_analysis.signals if breakdown else [])}

Lease Cost Analysis: {breakdown.lease_cost_analysis.summary if breakdown else 'Not available'}
Lease Cost Score: {_score(breakdown.lease_cost_analysis.score if breakdown else None)}
Lease Signals:
{_lines(breakdown.lease_cost_analysis.signals if breakdown else [])}

NOTES
This report is generated from the current Zonalyze prototype. The system combines real demographic inputs, synthetic business scenario data, and ML-backed prediction outputs. Results should be treated as decision-support information, not as a guaranteed business outcome.
"""

    return FeasibilityReportResponse(
        filename=filename,
        report_text=report_text,
    )
