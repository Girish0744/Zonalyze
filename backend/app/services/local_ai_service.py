from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests


DEFAULT_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


@dataclass
class LocalAIResult:
    available: bool
    answer: str
    model: str
    error: Optional[str] = None


def _base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/")


def _default_model() -> str:
    return os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)


def list_local_models(timeout_seconds: int = 3) -> List[str]:
    try:
        response = requests.get(f"{_base_url()}/api/tags", timeout=timeout_seconds)
        response.raise_for_status()
        payload = response.json()
        models = payload.get("models", []) or []
        names = []
        for model in models:
            name = model.get("name")
            if name:
                names.append(str(name))
        return names
    except Exception:
        return []


def get_local_ai_status() -> Dict[str, Any]:
    models = list_local_models()
    if models:
        return {
            "status": "ready",
            "provider": "ollama",
            "base_url": _base_url(),
            "default_model": _default_model(),
            "available_models": models,
            "message": "Local Ollama AI is reachable.",
        }

    return {
        "status": "unavailable",
        "provider": "ollama",
        "base_url": _base_url(),
        "default_model": _default_model(),
        "available_models": [],
        "message": (
            "Local Ollama AI is not reachable or no models are installed. "
            "Install Ollama, run `ollama pull llama3.2:3b`, and make sure Ollama is running."
        ),
    }


# def generate_with_ollama(
#     prompt: str,
#     model: Optional[str] = None,
#     timeout_seconds: int = 90,
# ) -> LocalAIResult:
#     selected_model = model or _default_model()

#     try:
#         response = requests.post(
#             f"{_base_url()}/api/generate",
#             json={
#                 "model": selected_model,
#                 "prompt": prompt,
#                 "stream": False,
#                 "options": {
#                     "temperature": 0.2,
#                     "top_p": 0.85,
#                 },
#             },
#             timeout=timeout_seconds,
#         )
#         response.raise_for_status()
#         payload = response.json()
#         answer = str(payload.get("response", "")).strip()

#         if not answer:
#             return LocalAIResult(
#                 available=False,
#                 answer="",
#                 model=selected_model,
#                 error="Ollama returned an empty response.",
#             )

#         return LocalAIResult(
#             available=True,
#             answer=answer,
#             model=selected_model,
#             error=None,
#         )
#     except Exception as exc:
#         return LocalAIResult(
#             available=False,
#             answer="",
#             model=selected_model,
#             error=str(exc),
#         )


def generate_with_ollama(
    prompt: str,
    model: Optional[str] = None,
    timeout_seconds: int | None = None,
) -> LocalAIResult:
    selected_model = model or _default_model()
    timeout = timeout_seconds or int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

    try:
        response = requests.post(
            f"{_base_url()}/api/generate",
            json={
                "model": selected_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "top_p": 0.85,
                    "num_predict": 260,
                    "num_ctx": 4096,
                },
            },
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        answer = str(payload.get("response", "")).strip()

        if not answer:
            return LocalAIResult(
                available=False,
                answer="",
                model=selected_model,
                error="Ollama returned an empty response.",
            )

        return LocalAIResult(
            available=True,
            answer=answer,
            model=selected_model,
            error=None,
        )
    except Exception as exc:
        return LocalAIResult(
            available=False,
            answer="",
            model=selected_model,
            error=str(exc),
        )