from pydantic import BaseModel, Field


class AnalyzeScenarioRequest(BaseModel):
    selected_zone: str = Field(..., min_length=2, max_length=100)
    selected_business_type: str = Field(..., min_length=2, max_length=100)
    radius_km: float = Field(..., gt=0, le=50)