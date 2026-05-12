from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Tuple


OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT_SECONDS = 18
CACHE_TTL_SECONDS = 60 * 60 * 6


@dataclass
class OSMFetchResult:
    status: str
    note: str
    elements: List[Dict]


_CACHE: Dict[str, Tuple[float, OSMFetchResult]] = {}


BUSINESS_OSM_TAGS: Dict[str, List[Tuple[str, str]]] = {
    "Coffee Shop": [("amenity", "cafe")],
    "Cafe": [("amenity", "cafe")],
    "Fast Food Restaurant": [("amenity", "fast_food")],
    "Restaurant": [("amenity", "restaurant")],
    "Indian Grocery Store": [("shop", "supermarket"), ("shop", "convenience"), ("shop", "greengrocer")],
    "Grocery Store": [("shop", "supermarket"), ("shop", "convenience"), ("shop", "greengrocer")],
    "Fitness Center": [("leisure", "fitness_centre"), ("amenity", "gym")],
    "Gym": [("leisure", "fitness_centre"), ("amenity", "gym")],
    "Hair Salon": [("shop", "hairdresser"), ("shop", "beauty")],
    "Salon": [("shop", "hairdresser"), ("shop", "beauty")],
    "Pharmacy": [("amenity", "pharmacy"), ("shop", "chemist")],
    "Bakery": [("shop", "bakery")],
    "Convenience Store": [("shop", "convenience")],
    "Retail Clothing Store": [("shop", "clothes")],
    "Dental Clinic": [("amenity", "dentist")],
    "Tutoring Center": [("amenity", "school"), ("office", "educational_institution")],
    "Laundromat": [("shop", "laundry"), ("amenity", "laundry")],
}

TRANSIT_TAGS: List[Tuple[str, str]] = [
    ("highway", "bus_stop"),
    ("public_transport", "platform"),
    ("railway", "station"),
    ("railway", "tram_stop"),
]

COMMERCIAL_ACTIVITY_TAGS: List[Tuple[str, str]] = [
    ("shop", "mall"),
    ("shop", "department_store"),
    ("amenity", "marketplace"),
    ("amenity", "bank"),
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _tag_query(tags: List[Tuple[str, str]], lat: float, lon: float, radius_m: int) -> str:
    clauses = []
    for key, value in tags:
        safe_key = key.replace('"', '')
        safe_value = value.replace('"', '')
        clauses.append(f'node["{safe_key}"="{safe_value}"](around:{radius_m},{lat},{lon});')
        clauses.append(f'way["{safe_key}"="{safe_value}"](around:{radius_m},{lat},{lon});')
        clauses.append(f'relation["{safe_key}"="{safe_value}"](around:{radius_m},{lat},{lon});')
    return "".join(clauses)


def build_overpass_query(tags: List[Tuple[str, str]], lat: float, lon: float, radius_km: float, limit: int = 80) -> str:
    radius_m = int(max(250, min(radius_km * 1000, 12000)))
    body = _tag_query(tags, lat, lon, radius_m)
    return f"""
[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];
(
  {body}
);
out center {limit};
""".strip()


def _fetch_overpass(query: str, cache_key: str) -> OSMFetchResult:
    cached = _CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    try:
        data = urllib.parse.urlencode({"data": query}).encode("utf-8")
        req = urllib.request.Request(
            OVERPASS_URL,
            data=data,
            headers={"User-Agent": "ZonalyzeCapstone/1.0 (educational prototype)"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=OVERPASS_TIMEOUT_SECONDS + 4) as response:
            payload = json.loads(response.read().decode("utf-8"))
        result = OSMFetchResult(
            status="live_osm",
            note="OpenStreetMap data retrieved through the public Overpass API. Results depend on OSM coverage and public API availability.",
            elements=payload.get("elements", []),
        )
    except Exception as exc:
        result = OSMFetchResult(
            status="fallback_proxy",
            note=f"Live OpenStreetMap query failed or timed out, so the map is using fallback evidence markers. Details: {type(exc).__name__}",
            elements=[],
        )

    _CACHE[cache_key] = (now, result)
    return result


def _normalize_element(element: Dict, center_lat: float, center_lon: float, category: str) -> Dict | None:
    lat = element.get("lat") or element.get("center", {}).get("lat")
    lon = element.get("lon") or element.get("center", {}).get("lon")
    if lat is None or lon is None:
        return None

    tags = element.get("tags", {}) or {}
    name = tags.get("name") or tags.get("brand") or category
    address_parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:city"),
    ]
    address = " ".join([part for part in address_parts if part]) or None
    distance_km = haversine_km(center_lat, center_lon, float(lat), float(lon))
    return {
        "osm_id": str(element.get("id")),
        "osm_type": str(element.get("type")),
        "name": name,
        "latitude": float(lat),
        "longitude": float(lon),
        "category": category,
        "address": address,
        "distance_km": round(distance_km, 3),
        "tags": tags,
    }


def fetch_osm_competitors(
    business_subcategory: str,
    center_lat: float,
    center_lon: float,
    radius_km: float,
    limit: int = 60,
) -> OSMFetchResult:
    tags = BUSINESS_OSM_TAGS.get(business_subcategory, [("shop", "yes"), ("amenity", "restaurant")])
    query = build_overpass_query(tags, center_lat, center_lon, radius_km, limit=limit)
    cache_key = f"competitors:{business_subcategory}:{center_lat:.4f}:{center_lon:.4f}:{radius_km}:{limit}"
    result = _fetch_overpass(query, cache_key)
    normalized: List[Dict] = []
    seen = set()
    for element in result.elements:
        item = _normalize_element(element, center_lat, center_lon, business_subcategory)
        if not item:
            continue
        key = (item["osm_type"], item["osm_id"])
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    normalized.sort(key=lambda row: row["distance_km"])
    return OSMFetchResult(status=result.status, note=result.note, elements=normalized[:limit])


def fetch_osm_transit(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    limit: int = 40,
) -> OSMFetchResult:
    query = build_overpass_query(TRANSIT_TAGS, center_lat, center_lon, radius_km, limit=limit)
    cache_key = f"transit:{center_lat:.4f}:{center_lon:.4f}:{radius_km}:{limit}"
    result = _fetch_overpass(query, cache_key)
    normalized: List[Dict] = []
    seen = set()
    for element in result.elements:
        item = _normalize_element(element, center_lat, center_lon, "Transit / Mobility")
        if not item:
            continue
        key = (item["osm_type"], item["osm_id"])
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    normalized.sort(key=lambda row: row["distance_km"])
    return OSMFetchResult(status=result.status, note=result.note, elements=normalized[:limit])


def fetch_osm_commercial_activity(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    limit: int = 30,
) -> OSMFetchResult:
    query = build_overpass_query(COMMERCIAL_ACTIVITY_TAGS, center_lat, center_lon, radius_km, limit=limit)
    cache_key = f"commercial:{center_lat:.4f}:{center_lon:.4f}:{radius_km}:{limit}"
    result = _fetch_overpass(query, cache_key)
    normalized: List[Dict] = []
    seen = set()
    for element in result.elements:
        item = _normalize_element(element, center_lat, center_lon, "Commercial activity")
        if not item:
            continue
        key = (item["osm_type"], item["osm_id"])
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    normalized.sort(key=lambda row: row["distance_km"])
    return OSMFetchResult(status=result.status, note=result.note, elements=normalized[:limit])
