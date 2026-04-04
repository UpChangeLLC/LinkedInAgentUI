"""Shared Pydantic models for the API layer."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    """Optional user-provided context to tailor the analysis."""

    concern: str = Field(default="", description="Primary concern: career_pivot, upskilling, team_readiness, curiosity")
    ai_involvement: int = Field(default=0, ge=0, le=5, description="Current AI involvement level 1-5 (0 = not specified)")
    industry: str = Field(default="", description="Industry segment")
    years_in_role: int = Field(default=0, ge=0, description="Years in current role (0 = not specified)")


class AgentRunRequest(BaseModel):
    """Input payload for agent execution."""

    linkedin_url: str = Field(default="")
    resume_text: str = Field(default="")
    github_url: str = Field(default="")
    website_url: str = Field(default="")
    user_context: Optional[UserContext] = Field(default=None)


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


class ScoreDelta(BaseModel):
    """Score change data from previous assessment (F22)."""

    previous_score: int = 0
    score_delta: int = 0
    previous_risk_band: str = ""
    days_since_last: int = 0
    dimension_deltas: Dict[str, int] = Field(default_factory=dict)
    previous_assessment_date: Optional[str] = None


class ActionItemSchema(BaseModel):
    """A single action item (F24)."""

    id: Optional[str] = None
    title: str
    description: str = ""
    category: str = "learning"  # learning, networking, projects, governance
    priority: str = "medium"    # high, medium, low
    estimated_hours: int = 0
    resource_url: str = ""
    resource_title: str = ""
    status: str = "pending"     # pending, in_progress, completed
    completed_at: Optional[str] = None


class ActionItemUpdate(BaseModel):
    """Partial update payload for an action item."""

    status: Optional[str] = None
    completed_at: Optional[str] = None


class PipelineEvent(BaseModel):
    """SSE event emitted during pipeline execution."""

    event_type: str  # node_start, node_complete, node_error, pipeline_complete, pipeline_error
    node: str = ""
    status: str = ""  # running, success, error
    duration_ms: int = 0
    info: str = ""
    data_points: int = 0  # e.g. skills extracted, data points fetched
    progress: int = 0  # 0-100 overall progress
    partial_result: Dict[str, Any] = Field(default_factory=dict)
