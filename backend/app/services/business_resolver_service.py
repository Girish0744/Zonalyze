from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.business_resolver import (
    BusinessResolveRequest,
    BusinessResolveResponse,
    OSMTagSuggestion,
)
from app.services.local_ai_service import generate_with_ollama


# IMPORTANT TRUST RULE
# --------------------
# This resolver intentionally contains NO business-specific keyword mapping,
# NO predefined business categories, NO brand list, and NO hardcoded
# business-to-OSM tag rules.
#
# It only performs generic JSON parsing and generic OSM tag shape validation.
# If local AI fails, the resolver returns `needs_review` instead of guessing.

MAX_TAGS = 10
MAX_TEXT_FIELD_LENGTH = 120
MAX_WARNING_COUNT = 8

OSM_KEY_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_:.-]{0,63}$")
OSM_VALUE_RE = re.compile(r"^[^\n\r\t]{1,120}$")
VALID_TAG_ROLES = {"primary", "secondary", "brand", "attribute", "name", "operator", "specialty", "other"}


def _normalize_text(value: Any, max_length: int = MAX_TEXT_FIELD_LENGTH) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_length]


def _normalize_role(value: Any) -> str:
    role = _normalize_text(value or "primary", 40).lower().replace(" ", "_")
    return role if role in VALID_TAG_ROLES else "other"


def _confidence_label(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    if score > 0:
        return "limited"
    return "unresolved"


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Extract one JSON object from a local model response without trusting prose."""
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


def _build_business_resolution_prompt(business_query: str) -> str:
    """
    Compact prompt for local AI.

    The prompt does not provide a hardcoded business catalog or tag examples that
    would bias the resolver. The model must infer the category/tags itself.
    """
    return f"""
Return ONLY valid JSON. No markdown. No explanation outside JSON.

You are resolving a user-entered business idea into OpenStreetMap search tags.
Do not estimate revenue, risk, lease, demand, or feasibility.
Separate business category, brand names, and specialty words.
For OSM tags, return only tags you believe are useful for finding similar businesses or related POIs in OpenStreetMap/Overpass.
If unsure, use a lower confidence and add a warning.

JSON schema:
{{
  "normalized_business_name": "short plain-English business name",
  "primary_category": "plain-English primary business category",
  "secondary_categories": ["optional categories"],
  "brand_terms": ["brand names mentioned by the user"],
  "specialty_terms": ["specialty terms mentioned by the user"],
  "osm_tags": [
    {{"key": "osm_key", "value": "osm_value", "confidence": 0.0, "tag_role": "primary|secondary|brand|attribute|name|operator|specialty|other", "reason": "brief reason"}}
  ],
  "confidence_score": 0.0,
  "warnings": ["uncertainties or coverage limitations"]
}}

User business idea: {business_query}
""".strip()


def _clean_text_list(value: Any, max_items: int = 6) -> List[str]:
    if not isinstance(value, list):
        return []
    cleaned: List[str] = []
    for item in value[:max_items]:
        text = _normalize_text(item)
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def _validate_tags(raw_tags: Any) -> Tuple[List[OSMTagSuggestion], List[Dict[str, Any]], List[str]]:
    """
    Generic validation only. No business-specific OSM mapping happens here.

    This function checks syntax/shape so invalid AI output cannot directly enter
    Overpass queries. It does not decide that any specific business should use a
    specific OSM tag.
    """
    accepted: List[OSMTagSuggestion] = []
    rejected: List[Dict[str, Any]] = []
    warnings: List[str] = []

    if not isinstance(raw_tags, list):
        return accepted, rejected, ["AI did not return an osm_tags list."]

    seen = set()

    for raw in raw_tags[:MAX_TAGS]:
        if not isinstance(raw, dict):
            rejected.append({"raw": raw, "reason": "Tag suggestion was not an object."})
            continue

        key = _normalize_text(raw.get("key"), 64).strip().lower()
        value = _normalize_text(raw.get("value"), 120).strip()
        role = _normalize_role(raw.get("tag_role"))
        reason = _normalize_text(raw.get("reason"), 180) or None

        try:
            confidence = float(raw.get("confidence", 0.5))
        except Exception:
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))

        if not key or not value:
            rejected.append({"raw": raw, "reason": "Missing tag key or value."})
            continue

        if not OSM_KEY_RE.match(key):
            rejected.append({"raw": raw, "reason": f"Invalid OSM key format: {key}"})
            continue

        if not OSM_VALUE_RE.match(value):
            rejected.append({"raw": raw, "reason": "Invalid OSM value format."})
            continue

        identifier = (key, value.lower(), role)
        if identifier in seen:
            continue
        seen.add(identifier)

        accepted.append(
            OSMTagSuggestion(
                key=key,
                value=value,
                confidence=confidence,
                tag_role=role,
                reason=reason,
            )
        )

    accepted.sort(key=lambda tag: -tag.confidence)

    if not accepted:
        warnings.append("No validated OSM tags were returned by local AI.")

    return accepted, rejected, warnings


def _needs_review_response(
    *,
    business_query: str,
    source_method: str,
    warning: str,
    raw_ai_error: Optional[str] = None,
    rejected_osm_tags: Optional[List[Dict[str, Any]]] = None,
) -> BusinessResolveResponse:
    return BusinessResolveResponse(
        status="needs_review",
        input_text=business_query,
        normalized_business_name="",
        primary_category="",
        secondary_categories=[],
        brand_terms=[],
        specialty_terms=[],
        osm_tags=[],
        rejected_osm_tags=rejected_osm_tags or [],
        resolution_confidence="unresolved",
        confidence_score=0.0,
        source_method=source_method,
        raw_ai_available=False,
        warnings=[warning],
        next_steps=[
            "Retry after confirming the local Ollama model is running and responsive.",
            "Do not run competitor evidence for this business until OSM tags are resolved.",
            "If needed, ask the user to clarify the business idea in simpler words.",
        ],
        raw_ai_error=raw_ai_error,
    )


def _coerce_ai_payload(payload: Dict[str, Any], business_query: str) -> Dict[str, Any]:
    return {
        "normalized_business_name": _normalize_text(payload.get("normalized_business_name")) or business_query,
        "primary_category": _normalize_text(payload.get("primary_category")) or "Unresolved business category",
        "secondary_categories": _clean_text_list(payload.get("secondary_categories")),
        "brand_terms": _clean_text_list(payload.get("brand_terms")),
        "specialty_terms": _clean_text_list(payload.get("specialty_terms")),
        "osm_tags": payload.get("osm_tags") or [],
        "confidence_score": payload.get("confidence_score", 0.0),
        "warnings": _clean_text_list(payload.get("warnings"), MAX_WARNING_COUNT),
    }


def resolve_business_query(request: BusinessResolveRequest) -> BusinessResolveResponse:
    business_query = _normalize_text(request.business_query, 240)

    if not business_query:
        return _needs_review_response(
            business_query=str(request.business_query or ""),
            source_method="input_validation_failed",
            warning="Business query was empty. Enter a business idea before resolving OSM tags.",
        )

    prompt = _build_business_resolution_prompt(business_query)
    ai_result = generate_with_ollama(prompt=prompt, model=request.model, timeout_seconds=90)

    if not ai_result.available:
        return _needs_review_response(
            business_query=business_query,
            source_method="local_ai_unavailable_no_fallback_category_mapping",
            warning=(
                "Local AI did not return a response. Zonalyze did not guess business categories, "
                "brands, or OSM tags because hardcoded category fallback is disabled."
            ),
            raw_ai_error=ai_result.error,
        )

    raw_payload = _extract_json_object(ai_result.answer)
    if not raw_payload:
        return _needs_review_response(
            business_query=business_query,
            source_method="local_ai_invalid_json_no_fallback_category_mapping",
            warning=(
                "Local AI returned text, but not valid structured JSON. Zonalyze did not guess "
                "business categories or OSM tags because hardcoded category fallback is disabled."
            ),
            raw_ai_error="Local AI response was not valid JSON.",
        )

    payload = _coerce_ai_payload(raw_payload, business_query)
    accepted_tags, rejected_tags, validation_warnings = _validate_tags(payload.get("osm_tags"))

    warnings = list(payload.get("warnings") or []) + validation_warnings

    try:
        confidence_score = float(payload.get("confidence_score", 0.0))
    except Exception:
        confidence_score = 0.0
    confidence_score = max(0.0, min(1.0, confidence_score))

    if not accepted_tags:
        return _needs_review_response(
            business_query=business_query,
            source_method="local_ai_no_validated_tags_no_fallback_category_mapping",
            warning=(
                "Local AI responded, but no valid OSM tags passed generic validation. Zonalyze did not "
                "invent replacement tags because hardcoded OSM mappings are disabled."
            ),
            raw_ai_error=None,
            rejected_osm_tags=rejected_tags,
        )

    # Cap confidence if the AI did not provide a meaningful category.
    if not payload.get("primary_category") or payload.get("primary_category") == "Unresolved business category":
        confidence_score = min(confidence_score, 0.35)
        warnings.append("Local AI did not provide a clear primary business category.")

    next_steps = [
        "Show this business interpretation and the OSM tags to the user before running full analysis.",
        "Use validated OSM tags for competitor and market-map evidence.",
        "Verify tag coverage with Overpass result counts before treating competitor evidence as strong.",
    ]

    if confidence_score < 0.45:
        next_steps.append("Ask the user to clarify the business idea or confirm the resolved category.")

    return BusinessResolveResponse(
        status="resolved",
        input_text=business_query,
        normalized_business_name=payload.get("normalized_business_name") or business_query,
        primary_category=payload.get("primary_category") or "Unresolved business category",
        secondary_categories=payload.get("secondary_categories") or [],
        brand_terms=payload.get("brand_terms") or [],
        specialty_terms=payload.get("specialty_terms") or [],
        osm_tags=accepted_tags,
        rejected_osm_tags=rejected_tags,
        resolution_confidence=_confidence_label(confidence_score),
        confidence_score=round(confidence_score, 3),
        source_method="local_ai_structured_osm_resolution_no_hardcoded_fallback",
        raw_ai_available=True,
        warnings=list(dict.fromkeys([warning for warning in warnings if warning]))[:MAX_WARNING_COUNT],
        next_steps=next_steps,
        raw_ai_error=None,
    )
