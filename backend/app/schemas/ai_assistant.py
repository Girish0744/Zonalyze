from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Either 'user' or 'assistant'.")
    content: str


class ScenarioChatRequest(BaseModel):
    municipality_name: str
    business_subcategory: str
    radius_km: float
    question: str
    chat_history: List[ChatMessage] = Field(default_factory=list)
    model: Optional[str] = Field(
        default=None,
        description="Optional Ollama model override. Example: llama3.2:3b or mistral.",
    )


class ScenarioChatResponse(BaseModel):
    status: str
    answer: str
    model: str
    ai_provider: str
    municipality_name: str
    business_subcategory: str
    radius_km: float
    used_signals: List[str]
    limitations: List[str]
    follow_up_suggestions: List[str]
    scenario_snapshot: Dict[str, Any]
    raw_ai_available: bool
    error: Optional[str] = None


class LocalAIStatusResponse(BaseModel):
    status: str
    provider: str = "ollama"
    base_url: str
    default_model: str
    available_models: List[str] = Field(default_factory=list)
    message: str
