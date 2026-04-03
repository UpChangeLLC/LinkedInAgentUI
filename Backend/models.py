"""Shared Pydantic models for the API layer."""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    """Input payload for agent execution."""

    linkedin_url: str = Field(default="")
    resume_text: str = Field(default="")


class AgentTraceStep(BaseModel):
    """Single execution step telemetry."""

    step: str
    success: bool
    duration_ms: int
    info: str = ""


class AgentRunResponse(BaseModel):
    """Agent response with trace."""

    status: str
    data_source: str
    trace: List[AgentTraceStep]
    result: Dict[str, Any]
