from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.core.mongo import get_mongo_collection
from app.schemas.business_resolver import BusinessResolveResponse


CACHE_COLLECTION_NAME = os.getenv("MONGODB_BUSINESS_RESOLUTION_COLLECTION", "business_resolution_cache")
CACHE_VERSION = "business_resolution_cache_v1_taginfo_verified"
DEFAULT_RESOLVED_TTL_HOURS = int(os.getenv("BUSINESS_RESOLUTION_CACHE_TTL_HOURS", "168"))  # 7 days


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(business_query: str, model: Optional[str]) -> str:
    normalized_query = " ".join((business_query or "").strip().lower().split())
    normalized_model = (model or os.getenv("OLLAMA_MODEL") or "default").strip().lower()
    raw = f"{CACHE_VERSION}|{normalized_model}|{normalized_query}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _collection():
    collection = get_mongo_collection(CACHE_COLLECTION_NAME)
    if collection is None:
        return None

    # Idempotent and safe. If indexes already exist, MongoDB ignores the duplicate request.
    try:
        collection.create_index("cache_key", unique=True, background=True)
        collection.create_index("expires_at", expireAfterSeconds=0, background=True)
        collection.create_index("business_query", background=True)
    except Exception:
        # Cache should never break business resolution.
        pass
    return collection


def _model_dump(model: Any) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(mode="json")
    if hasattr(model, "dict"):
        return model.dict()
    return dict(model)


def get_cached_business_resolution(
    *,
    business_query: str,
    model: Optional[str] = None,
) -> Optional[BusinessResolveResponse]:
    collection = _collection()
    if collection is None:
        return None

    key = _cache_key(business_query, model)
    try:
        document = collection.find_one(
            {
                "cache_key": key,
                "expires_at": {"$gt": _now_utc()},
            }
        )
    except Exception:
        return None

    if not document:
        return None

    response_payload = document.get("response")
    if not isinstance(response_payload, dict):
        return None

    try:
        response = BusinessResolveResponse(**response_payload)
        # Keep this transparent without changing the schema.
        warnings = list(response.warnings or [])
        if "Returned from MongoDB business-resolution cache." not in warnings:
            warnings.append("Returned from MongoDB business-resolution cache.")
        if hasattr(response, "model_copy"):
            return response.model_copy(update={"warnings": warnings})
        response.warnings = warnings
        return response
    except Exception:
        return None


def save_business_resolution_cache(
    *,
    business_query: str,
    model: Optional[str],
    response: BusinessResolveResponse,
    ttl_hours: Optional[int] = None,
) -> None:
    """Persist successful business resolutions.

    We cache only resolved results by default. We do not cache local-AI failures or
    needs_review responses because those can change after the model, prompt, or
    network availability is fixed.
    """
    if response.status != "resolved":
        return

    collection = _collection()
    if collection is None:
        return

    ttl = ttl_hours or DEFAULT_RESOLVED_TTL_HOURS
    now = _now_utc()
    key = _cache_key(business_query, model)

    document = {
        "cache_key": key,
        "cache_version": CACHE_VERSION,
        "business_query": business_query,
        "model": model or os.getenv("OLLAMA_MODEL") or "default",
        "status": response.status,
        "response": _model_dump(response),
        "created_at": now,
        "updated_at": now,
        "expires_at": now + timedelta(hours=ttl),
    }

    try:
        collection.update_one(
            {"cache_key": key},
            {
                "$set": document,
                "$inc": {"hit_source_generation_count": 1},
            },
            upsert=True,
        )
    except Exception:
        # Cache should never break business resolution.
        return
