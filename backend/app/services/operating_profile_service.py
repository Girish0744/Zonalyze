from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, List, Optional

from app.schemas.operating_profile import (
    OperatingProfileRange,
    OperatingProfileRequest,
    OperatingProfileResponse,
    OperatingProfileSection,
)
from app.services.local_ai_service import generate_with_ollama

try:
    from app.ml.scenario_feature_builder import build_prediction_features
except Exception:  # pragma: no cover
    build_prediction_features = None  # type: ignore

try:
    from app.services.business_resolver_service import resolve_business_query
    from app.schemas.business_resolver import BusinessResolveRequest
except Exception:  # pragma: no cover
    resolve_business_query = None  # type: ignore
    BusinessResolveRequest = None  # type: ignore

try:
    from app.services.competition_data_service import get_competition_observation
    from app.services.demand_data_service import get_demand_evidence
    from app.services.lease_cost_data_service import get_lease_cost_evidence
except Exception:  # pragma: no cover
    get_competition_observation = None  # type: ignore
    get_demand_evidence = None  # type: ignore
    get_lease_cost_evidence = None  # type: ignore

from app.services.operating_profile_cache_service import (
    get_cached_operating_profile,
    save_operating_profile_cache,
)


SECTION_KEYS = {
    "space_requirement": "Space Requirement",
    "lease_cost": "Lease Cost Range",
    "staffing": "Staffing Pattern and Cost",
    "customer_economics": "Customer Economics",
    "utilities_marketing": "Utilities and Marketing Context",
}


def _normalize_text(value: Any, max_length: int = 220) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_length]


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        number = float(value)
        return number if math.isfinite(number) else None
    except Exception:
        return None


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None

    return None


def _serializable(value: Any) -> Any:
    """Convert pydantic/dataclass-ish objects into JSON-friendly context."""
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "dict"):
        return value.dict()
    if isinstance(value, dict):
        return {str(k): _serializable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serializable(v) for v in value]
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _build_context(request: OperatingProfileRequest) -> Dict[str, Any]:
    business_label = request.business_query or request.business_subcategory or "business"
    context: Dict[str, Any] = {
        "municipality_name": request.municipality_name,
        "radius_km": request.radius_km,
        "business_query": request.business_query,
        "business_subcategory": request.business_subcategory,
        "business_resolution": request.business_resolution,
        "available_evidence": {},
        "notes": [],
    }

    # Resolve business if caller did not already provide a resolution.
    if not context["business_resolution"] and request.business_query and resolve_business_query and BusinessResolveRequest:
        try:
            resolution = resolve_business_query(
                BusinessResolveRequest(
                    business_query=request.business_query,
                    municipality_name=request.municipality_name,
                    model=request.model,
                )
            )
            context["business_resolution"] = _serializable(resolution)
        except Exception as exc:
            context["notes"].append(f"Business resolution unavailable: {type(exc).__name__}")

    # Add current census/evidence context when the known catalog path can build features.
    # This does not calculate operating profile numbers. It only supplies existing data signals to the AI.
    if build_prediction_features and request.business_subcategory:
        try:
            features = build_prediction_features(
                municipality_name=request.municipality_name,
                business_subcategory=request.business_subcategory,
                radius_km=request.radius_km,
            )
            selected_feature_keys = [
                "population_2021",
                "population_density_per_km2",
                "household_median_total_income_2020",
                "employment_rate_pct",
                "unemployment_rate_pct",
                "renter_average_monthly_shelter_cost",
                "rent_pressure_index_0_100",
                "market_base_index_0_100",
                "demand_score_0_100",
                "monthly_lease_cost_estimate",
                "lease_cost_low_estimate",
                "lease_cost_high_estimate",
                "monthly_staff_cost_estimate",
                "monthly_utilities_cost_estimate",
                "monthly_marketing_cost_estimate",
                "average_ticket_size",
                "estimated_space_sqft",
                "gross_margin_pct",
            ]
            context["available_evidence"]["runtime_features"] = {
                key: features.get(key) for key in selected_feature_keys if key in features
            }

            population = float(features.get("population_2021", 0) or 0)
            if get_competition_observation:
                competition = get_competition_observation(
                    municipality_name=request.municipality_name,
                    business_subcategory=request.business_subcategory,
                    radius_km=request.radius_km,
                    population=population,
                )
                context["available_evidence"]["competition"] = _serializable(competition)
            if get_demand_evidence:
                demand = get_demand_evidence(
                    municipality_name=request.municipality_name,
                    business_subcategory=request.business_subcategory,
                    radius_km=request.radius_km,
                    features=features,
                )
                context["available_evidence"]["demand"] = _serializable(demand)
            if get_lease_cost_evidence:
                lease = get_lease_cost_evidence(
                    municipality_name=request.municipality_name,
                    business_subcategory=request.business_subcategory,
                    radius_km=request.radius_km,
                    features=features,
                )
                context["available_evidence"]["lease"] = _serializable(lease)
        except Exception as exc:
            context["notes"].append(f"Catalog evidence unavailable for {business_label}: {type(exc).__name__}")

    return context


def _build_prompt(context: Dict[str, Any]) -> str:
    compact_context = json.dumps(context, ensure_ascii=False, default=str)[:9000]
    return f"""
Return ONLY valid JSON. No markdown. No prose outside JSON.

You are Zonalyze's operating-profile estimator for a capstone business-feasibility prototype.

Goal:
Generate useful planning estimates for the user's business scenario without asking the user to know lease cost, staffing cost, space, or ticket size upfront.

Strict rules:
- Do NOT claim values are observed unless the provided context includes observed/evidence-backed values.
- Do NOT mention "no source found" as the final answer. If direct evidence is weak, provide an AI benchmark planning estimate and label confidence as limited.
- Do NOT use a single exact number when a range is more honest.
- Do NOT fabricate source names or URLs.
- Use CAD for money.
- Use square feet for space.
- If provided evidence contains lease/staff/ticket/space values, use them as evidence context.
- If not, produce an AI benchmark range based on business type, municipality context, and operating model reasoning.
- Keep ranges realistic and conservative. Do not overstate precision.

Return this exact JSON shape:
{{
  "status": "estimated",
  "overall_confidence": "limited|moderate|high",
  "user_facing_note": "short note explaining this is a planning estimate with confidence labels",
  "sections": [
    {{
      "key": "space_requirement",
      "title": "Space Requirement",
      "status": "estimated|evidence_supported|limited_estimate|needs_review|unavailable",
      "estimate_type": "ai_benchmark_estimate|evidence_assisted_ai_estimate|observed_evidence|unavailable",
      "confidence": "limited|moderate|high|unavailable",
      "range": {{"low": 0, "median": 0, "high": 0, "unit": "sq ft", "display_value": "example range"}},
      "summary": "user-facing explanation",
      "reasoning": ["why this range fits the business model"],
      "evidence_used": ["specific evidence signals used from context, if any"],
      "limitations": ["what would improve this estimate"]
    }},
    {{"key":"lease_cost", "title":"Lease Cost Range", "status":"estimated", "estimate_type":"ai_benchmark_estimate", "confidence":"limited", "range":{{"low":0,"median":0,"high":0,"unit":"CAD/month","display_value":"example range"}}, "summary":"", "reasoning":[], "evidence_used":[], "limitations":[]}},
    {{"key":"staffing", "title":"Staffing Pattern and Cost", "status":"estimated", "estimate_type":"ai_benchmark_estimate", "confidence":"limited", "range":{{"low":0,"median":0,"high":0,"unit":"CAD/month","display_value":"example range"}}, "summary":"", "reasoning":[], "evidence_used":[], "limitations":[]}},
    {{"key":"customer_economics", "title":"Customer Economics", "status":"estimated", "estimate_type":"ai_benchmark_estimate", "confidence":"limited", "range":{{"low":0,"median":0,"high":0,"unit":"CAD/customer","display_value":"example range"}}, "summary":"", "reasoning":[], "evidence_used":[], "limitations":[]}},
    {{"key":"utilities_marketing", "title":"Utilities and Marketing Context", "status":"estimated", "estimate_type":"ai_benchmark_estimate", "confidence":"limited", "range":{{"low":0,"median":0,"high":0,"unit":"CAD/month","display_value":"example range"}}, "summary":"", "reasoning":[], "evidence_used":[], "limitations":[]}}
  ],
  "warnings": ["short transparent warnings"],
  "next_data_needed": ["data that would improve confidence"]
}}

Scenario context JSON:
{compact_context}
""".strip()


def _coerce_section(raw: Dict[str, Any], fallback_key: str) -> OperatingProfileSection:
    key = _normalize_text(raw.get("key") or fallback_key, 80).lower() or fallback_key
    title = _normalize_text(raw.get("title") or SECTION_KEYS.get(key, key.replace("_", " ").title()), 120)
    raw_range = raw.get("range") if isinstance(raw.get("range"), dict) else None
    range_obj = None
    if raw_range:
        range_obj = OperatingProfileRange(
            low=_safe_float(raw_range.get("low")),
            median=_safe_float(raw_range.get("median")),
            high=_safe_float(raw_range.get("high")),
            unit=_normalize_text(raw_range.get("unit"), 40),
            display_value=_normalize_text(raw_range.get("display_value"), 120),
        )

    def clean_list(value: Any, limit: int = 5) -> List[str]:
        if not isinstance(value, list):
            return []
        output: List[str] = []
        for item in value[:limit]:
            text = _normalize_text(item, 220)
            if text:
                output.append(text)
        return output

    return OperatingProfileSection(
        key=key,
        title=title,
        status=_normalize_text(raw.get("status") or "estimated", 60),
        estimate_type=_normalize_text(raw.get("estimate_type") or "ai_benchmark_estimate", 80),
        confidence=_normalize_text(raw.get("confidence") or "limited", 40),
        range=range_obj,
        summary=_normalize_text(raw.get("summary") or "Zonalyze generated a planning estimate for this section.", 400),
        reasoning=clean_list(raw.get("reasoning")),
        evidence_used=clean_list(raw.get("evidence_used")),
        limitations=clean_list(raw.get("limitations")),
    )


def _coerce_response(payload: Dict[str, Any], request: OperatingProfileRequest, context: Dict[str, Any], model: Optional[str]) -> OperatingProfileResponse:
    raw_sections = payload.get("sections") if isinstance(payload.get("sections"), list) else []
    sections: List[OperatingProfileSection] = []
    seen = set()

    for index, raw in enumerate(raw_sections):
        if not isinstance(raw, dict):
            continue
        fallback_key = list(SECTION_KEYS.keys())[min(index, len(SECTION_KEYS) - 1)]
        section = _coerce_section(raw, fallback_key)
        if section.key not in seen:
            sections.append(section)
            seen.add(section.key)

    # If the model omitted a section, ask the frontend to show a stable set by adding unavailable placeholders.
    # These placeholders do not invent values; they only prevent UI crashes.
    for key, title in SECTION_KEYS.items():
        if key not in seen:
            sections.append(
                OperatingProfileSection(
                    key=key,
                    title=title,
                    status="unavailable",
                    estimate_type="unavailable",
                    confidence="unavailable",
                    range=None,
                    summary="The local AI did not return this estimate in the required structured output.",
                    reasoning=[],
                    evidence_used=[],
                    limitations=["Retry operating profile generation or use a smaller/faster local model."],
                )
            )

    business_resolution = context.get("business_resolution") if isinstance(context.get("business_resolution"), dict) else {}
    normalized_business_name = business_resolution.get("normalized_business_name") or request.business_query or request.business_subcategory

    warnings = payload.get("warnings") if isinstance(payload.get("warnings"), list) else []
    next_data_needed = payload.get("next_data_needed") if isinstance(payload.get("next_data_needed"), list) else []

    return OperatingProfileResponse(
        status=_normalize_text(payload.get("status") or "estimated", 50),
        municipality_name=request.municipality_name,
        business_query=request.business_query,
        business_subcategory=request.business_subcategory,
        normalized_business_name=_normalize_text(normalized_business_name, 180),
        radius_km=request.radius_km,
        source_method="local_ai_benchmark_operating_profile_with_available_context",
        cache_status="miss",
        model=model,
        overall_confidence=_normalize_text(payload.get("overall_confidence") or "limited", 40),
        user_facing_note=_normalize_text(
            payload.get("user_facing_note")
            or "Zonalyze generated an AI benchmark operating profile for planning. Treat limited-confidence sections as estimates, not verified quotes.",
            500,
        ),
        sections=sections,
        warnings=[_normalize_text(item, 220) for item in warnings[:8] if _normalize_text(item, 220)],
        next_data_needed=[_normalize_text(item, 220) for item in next_data_needed[:8] if _normalize_text(item, 220)],
        raw_ai_available=True,
        raw_ai_error=None,
    )


def _ai_unavailable_response(request: OperatingProfileRequest, error: Optional[str]) -> OperatingProfileResponse:
    return OperatingProfileResponse(
        status="ai_unavailable",
        municipality_name=request.municipality_name,
        business_query=request.business_query,
        business_subcategory=request.business_subcategory,
        normalized_business_name=request.business_query or request.business_subcategory,
        radius_km=request.radius_km,
        source_method="local_ai_unavailable_no_static_formula_fallback",
        cache_status="not_saved",
        model=request.model,
        overall_confidence="unavailable",
        user_facing_note=(
            "The operating profile requires the local AI estimator. Zonalyze did not create static fallback numbers because operating costs must not be hardcoded."
        ),
        sections=[
            OperatingProfileSection(
                key=key,
                title=title,
                status="unavailable",
                estimate_type="unavailable",
                confidence="unavailable",
                range=None,
                summary="Local AI was unavailable, so Zonalyze did not generate an operating-cost estimate.",
                limitations=["Start Ollama or select a faster local model, then retry."],
            )
            for key, title in SECTION_KEYS.items()
        ],
        warnings=["Local AI was unavailable. No static operating-cost fallback was used."],
        next_data_needed=["Reliable operating profile generation requires local AI and, later, public wage/lease benchmark datasets."],
        raw_ai_available=False,
        raw_ai_error=error,
    )


def build_operating_profile(request: OperatingProfileRequest) -> OperatingProfileResponse:
    business_query = _normalize_text(request.business_query, 240) or None
    business_subcategory = _normalize_text(request.business_subcategory, 180) or None

    cached = get_cached_operating_profile(
        municipality_name=request.municipality_name,
        radius_km=request.radius_km,
        business_query=business_query,
        business_subcategory=business_subcategory,
        model=request.model,
    )
    if cached:
        return cached

    clean_request = OperatingProfileRequest(
        municipality_name=_normalize_text(request.municipality_name, 160),
        radius_km=request.radius_km,
        business_query=business_query,
        business_subcategory=business_subcategory,
        business_resolution=request.business_resolution,
        model=request.model,
    )

    context = _build_context(clean_request)
    prompt = _build_prompt(context)
    ai_result = generate_with_ollama(prompt=prompt, model=clean_request.model, timeout_seconds=120)

    if not ai_result.available:
        return _ai_unavailable_response(clean_request, ai_result.error)

    payload = _extract_json_object(ai_result.answer)
    if not payload:
        return _ai_unavailable_response(clean_request, "Local AI returned invalid JSON for operating profile.")

    response = _coerce_response(payload, clean_request, context, clean_request.model)
    saved = save_operating_profile_cache(
        municipality_name=clean_request.municipality_name,
        radius_km=clean_request.radius_km,
        business_query=clean_request.business_query,
        business_subcategory=clean_request.business_subcategory,
        model=clean_request.model,
        response=response,
    )
    response.cache_status = "miss_saved" if saved else "miss_not_saved"
    return response
