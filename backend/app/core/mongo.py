from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, Optional

try:
    from pymongo import MongoClient
    from pymongo.collection import Collection
    from pymongo.database import Database
    from pymongo.errors import PyMongoError
except Exception:  # pragma: no cover - keeps app bootable if pymongo not installed yet
    MongoClient = None  # type: ignore[assignment]
    Collection = Any  # type: ignore[misc, assignment]
    Database = Any  # type: ignore[misc, assignment]
    PyMongoError = Exception  # type: ignore[assignment]


DEFAULT_DB_NAME = "zonalyze"


def _mongodb_uri() -> str:
    return (os.getenv("MONGODB_URI") or "").strip()


def _mongodb_db_name() -> str:
    return (os.getenv("MONGODB_DB_NAME") or DEFAULT_DB_NAME).strip() or DEFAULT_DB_NAME


def is_mongodb_configured() -> bool:
    return bool(_mongodb_uri())


def is_pymongo_installed() -> bool:
    return MongoClient is not None


@lru_cache(maxsize=1)
def get_mongo_client() -> Optional[MongoClient]:  # type: ignore[valid-type]
    """Return a cached MongoDB client, or None when MongoDB is disabled.

    MongoDB is optional. If MONGODB_URI is missing or pymongo is not installed,
    the rest of the app must continue working with no database side effects.
    """
    uri = _mongodb_uri()
    if not uri or MongoClient is None:
        return None

    return MongoClient(
        uri,
        serverSelectionTimeoutMS=int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")),
        connectTimeoutMS=int(os.getenv("MONGODB_CONNECT_TIMEOUT_MS", "5000")),
        socketTimeoutMS=int(os.getenv("MONGODB_SOCKET_TIMEOUT_MS", "8000")),
    )


def get_mongo_database() -> Optional[Database]:  # type: ignore[valid-type]
    client = get_mongo_client()
    if client is None:
        return None
    return client[_mongodb_db_name()]


def get_mongo_collection(name: str) -> Optional[Collection]:  # type: ignore[valid-type]
    database = get_mongo_database()
    if database is None:
        return None
    return database[name]


def ping_mongodb() -> Dict[str, Any]:
    """Small health check used by /storage/mongo-status."""
    if not is_mongodb_configured():
        return {
            "enabled": False,
            "status": "disabled",
            "database_name": _mongodb_db_name(),
            "message": "MONGODB_URI is not configured. MongoDB cache is disabled.",
        }

    if not is_pymongo_installed():
        return {
            "enabled": False,
            "status": "dependency_missing",
            "database_name": _mongodb_db_name(),
            "message": "pymongo is not installed. Run: pip install pymongo",
        }

    client = get_mongo_client()
    if client is None:
        return {
            "enabled": False,
            "status": "client_unavailable",
            "database_name": _mongodb_db_name(),
            "message": "MongoDB client could not be created.",
        }

    try:
        client.admin.command("ping")
        return {
            "enabled": True,
            "status": "ready",
            "database_name": _mongodb_db_name(),
            "message": "MongoDB Atlas/local MongoDB is reachable.",
        }
    except PyMongoError as exc:
        return {
            "enabled": True,
            "status": "unreachable",
            "database_name": _mongodb_db_name(),
            "message": str(exc),
        }
