"""Vendored copy of the upchange-ml-platform `/v1/score` contract.

This is the single shape both the orchestrator and the ML platform agree on.
Pinned by ``CONTRACT_VERSION``; the orchestrator rejects an unrecognized
``scoring_version`` and falls through to the v0 scorer. Keep in sync via PR in
both repos (doc 02 §11.3).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

CONTRACT_VERSION = "1.0.0"


class ScoreRequest(BaseModel):
    pipeline_run_id: Optional[str] = None
    canonical_profile: Dict[str, Any] = Field(default_factory=dict)
    survey_responses: Dict[str, Any] = Field(default_factory=dict)
    user_context: Dict[str, Any] = Field(default_factory=dict)
    include_explain: bool = True


class ShapContribution(BaseModel):
    dimension: str
    contribution_points: float
    direction: Optional[Literal["positive", "negative"]] = None


class ScoreResponse(BaseModel):
    resilience_score: float
    readiness_score: float
    resilience_percentile: Optional[int] = None
    readiness_percentile: Optional[int] = None
    risk_band: Optional[str] = None
    dimension_scores: Dict[str, Any] = Field(default_factory=dict)
    shap_attribution: List[ShapContribution] = Field(default_factory=list)
    summary_scaffold: Optional[str] = None
    model_version: Optional[str] = None
    onet_version: Optional[str] = None
    scoring_version: Literal["v1"] = "v1"
