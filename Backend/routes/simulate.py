"""What-If simulator endpoint: re-score the profile with scenario patches.

Reuses the ML seam via services.simulate (cached base profile + /v1/score), so
it never scrapes or calls an LLM — only the fast model scoring call.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.simulate import simulate as run_simulate

router = APIRouter()


class ScenarioPatch(BaseModel):
    type: str
    value: Optional[Any] = None


class SimulateRequest(BaseModel):
    linkedin_url: str
    survey_responses: Optional[Dict[str, Any]] = None
    user_context: Optional[Dict[str, Any]] = None
    scenarios: List[ScenarioPatch] = Field(default_factory=list)


@router.post("/api/simulate")
async def post_simulate(body: SimulateRequest) -> Dict[str, Any]:
    """Return model-computed projected resilience/readiness for the given
    scenario set. {available:false} when the base profile isn't cached."""
    return await run_simulate(
        linkedin_url=body.linkedin_url,
        survey_responses=body.survey_responses,
        user_context=body.user_context,
        scenarios=[s.model_dump() for s in body.scenarios],
    )
