from pydantic import BaseModel
from typing import List, Optional


class GeoCoordinate(BaseModel):
    latitude: float
    longitude: float


class MapMarker(BaseModel):
    marker_id: str
    marker_type: str
    label: str
    latitude: float
    longitude: float
    x_offset_pct: float
    y_offset_pct: float
    intensity: float
    source_method: str
    credibility: str
    osm_id: Optional[str] = None
    osm_type: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    address_source: Optional[str] = None
    tags: dict = {}


class HeatmapCell(BaseModel):
    cell_id: str
    latitude: float
    longitude: float
    demand_intensity: float
    risk_intensity: float
    label: str
    source_method: str


class GeospatialMarketContext(BaseModel):
    municipality_name: str
    business_subcategory: str
    radius_km: int
    center: GeoCoordinate
    map_method: str
    map_credibility: str
    coverage_note: str
    evidence_note: str
    radius_label: str
    competition_pressure_index: float
    demand_pressure_index: float
    rent_pressure_index: float
    marker_count: int
    real_competitor_count: int
    transit_marker_count: int
    lease_marker_count: int
    markers: List[MapMarker]
    heatmap_cells: List[HeatmapCell]
    osm_query_status: str
    osm_query_note: str
    next_data_needed: List[str]
