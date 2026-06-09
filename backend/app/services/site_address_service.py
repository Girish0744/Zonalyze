from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import requests

from app.schemas.site_address import (
    SiteAddressAnalysisRequest,
    SiteAddressAnalysisResponse,
    SiteCoordinate,
    SiteEvidenceItem,
    SiteEvidenceSummary,
)
from app.services.osm_service import (
    fetch_osm_commercial_activity,
    fetch_osm_competitors,
    fetch_osm_transit,
)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _geocode_site_address(address_line: str, municipality_name: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    warnings: List[str] = []
    query_variants = [
        f"{address_line}, {municipality_name}, Ontario, Canada",
        f"{address_line}, {municipality_name}, ON, Canada",
        f"{address_line}, Ontario, Canada",
    ]
    headers = {
        "User-Agent": "ZonalyzeCapstone/1.0 site-address-analysis",
        "Accept": "application/json",
    }

    for query in query_variants:
        try:
            response = requests.get(
                NOMINATIM_URL,
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
            rows = response.json() or []
            if not rows:
                continue
            row = rows[0]
            return {
                "latitude": float(row["lat"]),
                "longitude": float(row["lon"]),
                "display_name": str(row.get("display_name") or query),
                "importance": row.get("importance"),
                "type": row.get("type"),
                "class": row.get("class"),
            }, warnings
        except Exception as exc:
            warnings.append(f"Geocoding attempt failed for '{query}': {type(exc).__name__}")

    return None, warnings


def _confidence_from_geocode(row: Dict[str, Any]) -> str:
    importance = row.get("importance")
    try:
        score = float(importance)
    except Exception:
        score = 0.0
    if score >= 0.55:
        return "high"
    if score >= 0.30:
        return "moderate"
    return "limited"


def _poi_to_evidence_item(poi: Dict[str, Any], center_lat: float, center_lon: float) -> Optional[SiteEvidenceItem]:
    try:
        lat = float(poi["latitude"])
        lon = float(poi["longitude"])
    except Exception:
        return None
    name = str(poi.get("name") or poi.get("category") or "OpenStreetMap evidence point")
    category = str(poi.get("category") or "OpenStreetMap evidence")
    distance = poi.get("distance_km")
    try:
        distance_km = float(distance)
    except Exception:
        distance_km = _haversine_km(center_lat, center_lon, lat, lon)
    return SiteEvidenceItem(
        name=name,
        category=category,
        distance_km=round(distance_km, 3),
        latitude=round(lat, 6),
        longitude=round(lon, 6),
        address=poi.get("address"),
    )


def _summary_from_pois(pois: List[Dict[str, Any]], center_lat: float, center_lon: float, limit: int = 8) -> SiteEvidenceSummary:
    items: List[SiteEvidenceItem] = []
    for poi in pois:
        item = _poi_to_evidence_item(poi, center_lat, center_lon)
        if item:
            items.append(item)
    items.sort(key=lambda row: row.distance_km)
    visible = items[:limit]
    return SiteEvidenceSummary(count=len(items), nearest=visible[0] if visible else None, items=visible)


def analyze_site_address(request: SiteAddressAnalysisRequest) -> SiteAddressAnalysisResponse:
    geocode, geocode_warnings = _geocode_site_address(request.address_line, request.municipality_name)

    if not geocode:
        return SiteAddressAnalysisResponse(
            status="geocode_failed",
            input_address=request.address_line,
            resolved_address=None,
            municipality_name=request.municipality_name,
            radius_km=request.radius_km,
            coordinate=None,
            geocode_source="OpenStreetMap Nominatim",
            geocode_confidence="unavailable",
            competitor_evidence=SiteEvidenceSummary(count=0, items=[]),
            transit_evidence=SiteEvidenceSummary(count=0, items=[]),
            commercial_activity_evidence=SiteEvidenceSummary(count=0, items=[]),
            source_method="site_address_geocoding_failed_no_synthetic_site_evidence",
            user_facing_note="Zonalyze could not geocode this address, so it did not create site-level evidence for it.",
            warnings=[*geocode_warnings, "Try adding street number, city, province, or postal code."],
            next_steps=["Confirm the address spelling.", "Try a nearby landmark or full postal address."],
        )

    lat = float(geocode["latitude"])
    lon = float(geocode["longitude"])

    warnings: List[str] = list(geocode_warnings)

    transit = fetch_osm_transit(center_lat=lat, center_lon=lon, radius_km=request.radius_km, limit=40)
    commercial = fetch_osm_commercial_activity(center_lat=lat, center_lon=lon, radius_km=request.radius_km, limit=40)

    competitor_items: List[Dict[str, Any]] = []
    competitor_note = "Competitor lookup requires a known catalog business subcategory."
    if request.business_subcategory:
        competitors = fetch_osm_competitors(
            business_subcategory=request.business_subcategory,
            center_lat=lat,
            center_lon=lon,
            radius_km=request.radius_km,
            limit=50,
        )
        competitor_items = competitors.elements
        competitor_note = competitors.note
    else:
        warnings.append("No catalog business_subcategory was supplied, so site-level competitor lookup was skipped.")

    if transit.status != "live_osm":
        warnings.append(transit.note)
    if commercial.status != "live_osm":
        warnings.append(commercial.note)
    if competitor_note:
        warnings.append(competitor_note)

    return SiteAddressAnalysisResponse(
        status="available",
        input_address=request.address_line,
        resolved_address=geocode.get("display_name"),
        municipality_name=request.municipality_name,
        radius_km=request.radius_km,
        coordinate=SiteCoordinate(latitude=round(lat, 6), longitude=round(lon, 6)),
        geocode_source="OpenStreetMap Nominatim",
        geocode_confidence=_confidence_from_geocode(geocode),
        competitor_evidence=_summary_from_pois(competitor_items, lat, lon),
        transit_evidence=_summary_from_pois(transit.elements, lat, lon),
        commercial_activity_evidence=_summary_from_pois(commercial.elements, lat, lon),
        source_method="site_address_osm_nominatim_plus_overpass_evidence",
        user_facing_note=(
            "This is site-level public map evidence from OpenStreetMap/Nominatim/Overpass. "
            "It supports address-level screening, but it is not a verified lease listing or live pedestrian count."
        ),
        warnings=warnings[:8],
        next_steps=[
            "Use this site evidence to compare addresses before deeper lease or inspection research.",
            "Verify the exact property, storefront access, parking, and lease terms before making an investment decision.",
        ],
    )
