from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

from app.ml.scenario_feature_builder import build_prediction_features
from app.schemas.geospatial import GeoCoordinate, GeospatialMarketContext, HeatmapCell, MapMarker
from app.schemas.scenario import AnalyzeScenarioRequest
from app.services.competition_data_service import get_competition_observation
from app.services.demand_data_service import get_demand_evidence
from app.services.lease_cost_data_service import get_lease_cost_evidence
from app.services.osm_service import (
    fetch_osm_competitors,
    fetch_osm_transit,
)


APP_DIR = Path(__file__).resolve().parents[1]
GEOCODE_CACHE_PATH = APP_DIR / "data" / "generated" / "municipality_geocode_cache.json"

# Small offline seed for the main Waterloo Region municipalities only.
# For every other Ontario municipality, the service geocodes dynamically through OpenStreetMap Nominatim and caches the result.
MUNICIPALITY_CENTERS: Dict[str, Tuple[float, float]] = {
    "Kitchener": (43.4516, -80.4925),
    "Waterloo": (43.4643, -80.5204),
    "Cambridge": (43.3616, -80.3144),
    "Woolwich": (43.5668, -80.4831),
    "Wilmot": (43.4000, -80.6500),
    "Wellesley": (43.5500, -80.7500),
    "North Dumfries": (43.2830, -80.3830),
}


def _normalize_place_name(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def _load_geocode_cache() -> Dict[str, Tuple[float, float]]:
    if not GEOCODE_CACHE_PATH.exists():
        return {}
    try:
        raw = json.loads(GEOCODE_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

    cache: Dict[str, Tuple[float, float]] = {}
    for key, value in raw.items():
        try:
            lat = float(value["latitude"])
            lng = float(value["longitude"])
            if math.isfinite(lat) and math.isfinite(lng):
                cache[key] = (lat, lng)
        except Exception:
            continue
    return cache


def _save_geocode_cache(cache: Dict[str, Tuple[float, float]]) -> None:
    GEOCODE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    serializable = {
        key: {"latitude": lat, "longitude": lng}
        for key, (lat, lng) in sorted(cache.items())
    }
    GEOCODE_CACHE_PATH.write_text(json.dumps(serializable, indent=2), encoding="utf-8")


def _geocode_municipality_with_osm(municipality_name: str) -> Optional[Tuple[float, float]]:
    """Free dynamic geocoding through OpenStreetMap Nominatim.

    This makes the map center dynamic for any selected Ontario municipality such as Kingston,
    London, Ottawa, Toronto, etc. Results are cached locally in app/data/generated.
    """
    name = _normalize_place_name(municipality_name)
    if not name:
        return None

    cache_key = name.lower()
    cache = _load_geocode_cache()
    if cache_key in cache:
        return cache[cache_key]

    query_variants = [
        f"{name}, Ontario, Canada",
        f"{name}, ON, Canada",
        f"City of {name}, Ontario, Canada",
        f"Township of {name}, Ontario, Canada",
    ]

    headers = {
        "User-Agent": "ZonalyzeCapstone/1.0 (local capstone prototype)",
        "Accept": "application/json",
    }

    for query in query_variants:
        try:
            response = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "jsonv2",
                    "limit": 1,
                    "countrycodes": "ca",
                    "addressdetails": 1,
                },
                headers=headers,
                timeout=8,
            )
            response.raise_for_status()
            results = response.json()
            if not results:
                continue

            first = results[0]
            lat = float(first["lat"])
            lng = float(first["lon"])
            if math.isfinite(lat) and math.isfinite(lng):
                cache[cache_key] = (lat, lng)
                _save_geocode_cache(cache)
                return lat, lng
        except Exception:
            continue

    return None


def _center_for_municipality(municipality_name: str) -> Tuple[float, float]:
    name = _normalize_place_name(municipality_name)

    if name in MUNICIPALITY_CENTERS:
        return MUNICIPALITY_CENTERS[name]

    dynamic_center = _geocode_municipality_with_osm(name)
    if dynamic_center:
        return dynamic_center

    # Do not silently fall back to Kitchener for unknown municipalities.
    # This fallback is only to keep the API alive when offline/geocoding fails.
    # The returned evidence note below makes the limitation visible.
    return (44.0000, -79.5000)


def _offset_coordinate(lat: float, lng: float, x_pct: float, y_pct: float, radius_km: float) -> Tuple[float, float]:
    km_x = (x_pct / 100.0) * radius_km
    km_y = (y_pct / 100.0) * radius_km
    lat_offset = km_y / 111.0
    lng_offset = km_x / (111.0 * max(math.cos(math.radians(lat)), 0.2))
    return lat + lat_offset, lng + lng_offset


def _xy_offsets_from_coordinate(center_lat: float, center_lng: float, lat: float, lng: float, radius_km: float) -> Tuple[float, float]:
    km_y = (lat - center_lat) * 111.0
    km_x = (lng - center_lng) * 111.0 * max(math.cos(math.radians(center_lat)), 0.2)
    if radius_km <= 0:
        return 0.0, 0.0
    return (km_x / radius_km) * 100.0, (km_y / radius_km) * 100.0


def _marker_offsets(count: int) -> List[Tuple[float, float]]:
    base = [
        (-38, -12), (-24, 28), (-10, -35), (12, 18), (26, -22),
        (38, 8), (-44, 36), (44, -38), (0, 42), (18, -46),
    ]
    return base[: max(0, min(count, len(base)))]


def _fallback_competitor_markers(
    center_lat: float,
    center_lng: float,
    radius_km: float,
    competitor_count: int,
    intensity: float,
    credibility: str,
    source_method: str,
) -> List[MapMarker]:
    rendered_competitors = min(max(competitor_count, 1), 10)
    markers: List[MapMarker] = []
    for index, (x_pct, y_pct) in enumerate(_marker_offsets(rendered_competitors), start=1):
        lat, lng = _offset_coordinate(center_lat, center_lng, x_pct, y_pct, radius_km)
        markers.append(
            MapMarker(
                marker_id=f"competitor-proxy-{index}",
                marker_type="competitor_proxy",
                label=f"Proxy competitor marker {index}",
                latitude=round(lat, 6),
                longitude=round(lng, 6),
                x_offset_pct=x_pct,
                y_offset_pct=y_pct,
                intensity=float(intensity),
                source_method=source_method,
                credibility=credibility,
                category="Proxy competitor",
                tags={},
            )
        )
    return markers


def _build_heatmap_cells(
    center_lat: float,
    center_lng: float,
    radius_km: float,
    demand_index: float,
    risk_index: float,
) -> List[HeatmapCell]:
    cells: List[HeatmapCell] = []
    offsets = [(-35, 30), (0, 36), (35, 30), (-28, 0), (0, 0), (28, 0), (-35, -30), (0, -36), (35, -30)]
    for i, (x_pct, y_pct) in enumerate(offsets, start=1):
        lat, lng = _offset_coordinate(center_lat, center_lng, x_pct, y_pct, radius_km)
        center_bias = max(0.0, 1.0 - (abs(x_pct) + abs(y_pct)) / 100.0)
        demand = max(0, min(100, demand_index * (0.82 + center_bias * 0.28)))
        risk = max(0, min(100, risk_index * (0.78 + (1 - center_bias) * 0.35)))
        cells.append(
            HeatmapCell(
                cell_id=f"heat-{i}",
                latitude=round(lat, 6),
                longitude=round(lng, 6),
                demand_intensity=round(demand, 2),
                risk_intensity=round(risk, 2),
                label=f"Demand {demand:.0f} / Risk {risk:.0f}",
                source_method="derived from demand, competition, and lease evidence layers",
            )
        )
    return cells


def build_geospatial_market_context(request: AnalyzeScenarioRequest) -> GeospatialMarketContext:
    features = build_prediction_features(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
    )
    population = float(features.get("population_2021", 0) or 0)
    center_lat, center_lng = _center_for_municipality(request.municipality_name)
    geocode_fallback_used = (round(center_lat, 4), round(center_lng, 4)) == (44.0000, -79.5000)

    competition = get_competition_observation(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        population=population,
    )
    demand = get_demand_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )
    lease = get_lease_cost_evidence(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        features=features,
    )

    competitor_result = fetch_osm_competitors(
        business_subcategory=request.business_subcategory,
        center_lat=center_lat,
        center_lon=center_lng,
        radius_km=request.radius_km,
        limit=60,
    )
    transit_result = fetch_osm_transit(center_lat=center_lat, center_lon=center_lng, radius_km=request.radius_km, limit=30)

    markers: List[MapMarker] = []

    for index, poi in enumerate(competitor_result.elements[:35], start=1):
        x_pct, y_pct = _xy_offsets_from_coordinate(center_lat, center_lng, poi["latitude"], poi["longitude"], request.radius_km)
        markers.append(
            MapMarker(
                marker_id=f"osm-competitor-{index}-{poi.get('osm_id')}",
                marker_type="competitor",
                label=poi.get("name") or f"Competitor {index}",
                latitude=round(float(poi["latitude"]), 6),
                longitude=round(float(poi["longitude"]), 6),
                x_offset_pct=round(x_pct, 2),
                y_offset_pct=round(y_pct, 2),
                intensity=float(competition.competition_pressure_index if competition else 50),
                source_method="OpenStreetMap Overpass API",
                credibility="medium" if competitor_result.status == "live_osm" else "limited",
                osm_id=poi.get("osm_id"),
                osm_type=poi.get("osm_type"),
                category=poi.get("category"),
                address=poi.get("address"),
                tags=poi.get("tags") or {},
            )
        )

    # Only show proxy competitors when the live OSM competitor query fails.
    # If OSM worked but the relevance filter found zero true competitors, showing
    # fake competitor pins would mislead the user. In that case, the map should
    # honestly show zero direct competitor markers.
    if not markers and competitor_result.status != "live_osm":
        competitor_count = int(competition.observed_competitor_count if competition else 0)
        markers.extend(
            _fallback_competitor_markers(
                center_lat=center_lat,
                center_lng=center_lng,
                radius_km=request.radius_km,
                competitor_count=competitor_count,
                intensity=float(competition.competition_pressure_index if competition else 50),
                credibility=competition.credibility if competition else "limited",
                source_method="fallback competition evidence catalog",
            )
        )

    for index, poi in enumerate(transit_result.elements[:18], start=1):
        x_pct, y_pct = _xy_offsets_from_coordinate(center_lat, center_lng, poi["latitude"], poi["longitude"], request.radius_km)
        markers.append(
            MapMarker(
                marker_id=f"osm-transit-{index}-{poi.get('osm_id')}",
                marker_type="transit",
                label=poi.get("name") or "Transit access point",
                latitude=round(float(poi["latitude"]), 6),
                longitude=round(float(poi["longitude"]), 6),
                x_offset_pct=round(x_pct, 2),
                y_offset_pct=round(y_pct, 2),
                intensity=float(demand.transit_access_proxy_index),
                source_method="OpenStreetMap Overpass API",
                credibility="medium" if transit_result.status == "live_osm" else "limited",
                osm_id=poi.get("osm_id"),
                osm_type=poi.get("osm_type"),
                category="Transit / mobility",
                address=poi.get("address"),
                tags=poi.get("tags") or {},
            )
        )

    risk_index = min(100.0, max(0.0, (float(competition.competition_pressure_index if competition else 50) * 0.45) + (float(lease.rent_pressure_index) * 0.45) + ((100 - float(demand.demand_pressure_index)) * 0.10)))
    heatmap_cells = _build_heatmap_cells(
        center_lat=center_lat,
        center_lng=center_lng,
        radius_km=request.radius_km,
        demand_index=float(demand.demand_pressure_index),
        risk_index=risk_index,
    )

    osm_statuses = {competitor_result.status, transit_result.status}
    if "live_osm" in osm_statuses:
        osm_query_status = "live_osm_partial" if "fallback_proxy" in osm_statuses else "live_osm"
    else:
        osm_query_status = "fallback_proxy"

    osm_query_note = " ".join(sorted({competitor_result.note, transit_result.note}))

    return GeospatialMarketContext(
        municipality_name=request.municipality_name,
        business_subcategory=request.business_subcategory,
        radius_km=request.radius_km,
        center=GeoCoordinate(latitude=center_lat, longitude=center_lng),
        map_method="leaflet_osm_overpass_plus_evidence_layers",
        map_credibility="medium" if osm_query_status.startswith("live_osm") else "limited",
        coverage_note=(
            "The radius is dynamically centered on the selected municipality using cached coordinates or OpenStreetMap geocoding. Competitor and transit markers use live OpenStreetMap coordinates when available."
            if not geocode_fallback_used
            else "The selected municipality could not be geocoded online, so a temporary Ontario fallback center is shown. Check internet access or cache this municipality coordinate."
        ),
        evidence_note=(
            "OpenStreetMap points improve geospatial realism, but they do not guarantee complete market coverage. The map currently displays direct competitor and transit-access evidence only."
        ),
        radius_label=f"{request.radius_km} km analysis radius",
        competition_pressure_index=float(competition.competition_pressure_index if competition else 0),
        demand_pressure_index=float(demand.demand_pressure_index),
        rent_pressure_index=float(lease.rent_pressure_index),
        marker_count=len(markers),
        real_competitor_count=len([m for m in markers if m.marker_type == "competitor"]),
        transit_marker_count=len([m for m in markers if m.marker_type == "transit"]),
        lease_marker_count=0,
        markers=markers,
        heatmap_cells=heatmap_cells,
        osm_query_status=osm_query_status,
        osm_query_note=osm_query_note,
        next_data_needed=[
            "Commercial lease listing coordinates and asking rents",
            "Observed pedestrian or mobility data for true foot-traffic intensity",
            "Municipal business licence data for more complete competitor coverage",
            "Neighbourhood or parcel boundaries for more precise site-level coverage",
        ],
    )
