from typing import Dict, List

from pydantic import BaseModel

from app.schemas.sensor_packet import SensorPacket


class MonitorStatus(BaseModel):
    name: str
    value: str
    indicator: str


class MLPredictionResponse(BaseModel):
    predicted_risk_class: str
    risk_probabilities: Dict[str, float]
    predicted_monthly_net_revenue: float
    predicted_feasibility_score: float
    recommendation: str


class ModuleAnalysisResponse(BaseModel):
    score: float
    level: str
    summary: str
    signals: List[str]
    metrics: Dict[str, float]


class AnalysisBreakdownResponse(BaseModel):
    demand_analysis: ModuleAnalysisResponse
    competition_analysis: ModuleAnalysisResponse
    lease_cost_analysis: ModuleAnalysisResponse


class PredictionExplanationResponse(BaseModel):
    competition_score: float
    demand_score: float
    demographic_fit_score: float
    estimated_competitor_count: int
    reachable_population_estimate: float
    monthly_lease_cost_estimate: float
    monthly_operating_cost_estimate: float
    revenue_explanation: str
    risk_explanation: str
    feasibility_explanation: str
    top_positive_factors: List[str]
    top_negative_factors: List[str]


class DashboardSummaryResponse(BaseModel):
    application_name: str
    project_phase: str

    municipality_name: str
    business_subcategory: str
    radius_km: float

    people_location_packet: SensorPacket
    competition_monitor: MonitorStatus
    revenue_monitor: MonitorStatus
    risk_monitor: MonitorStatus

    ml_prediction: MLPredictionResponse | None = None
    prediction_explanation: PredictionExplanationResponse | None = None
    analysis_breakdown: AnalysisBreakdownResponse | None = None
