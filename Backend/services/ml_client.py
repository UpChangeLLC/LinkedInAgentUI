"""Scoring seam between the orchestrator and the ML platform.

`score_profile` is the single integration point (called from
`ai_backend.analyze_node_graph`). It dispatches on the `USE_ML_PLATFORM` flag:

* enabled  -> POST the profile to the ML platform `/v1/score`; on any error
  (timeout, 5xx, connect, bad contract) fall through to v0 so the pipeline
  never fails before the platform is live.
* disabled -> wrap the existing `calibrate_score` and map its output into the
  resilience/readiness shape **additively** (keeps `profile_score` so the
  frontend transform is unchanged until the `RESILIENCE_V1` cutover).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


def _platform_enabled() -> bool:
    return os.getenv("USE_ML_PLATFORM", "false").strip().lower() == "true"


async def _call_ml_platform(payload: Dict[str, Any]) -> Dict[str, Any]:
    """POST to the ML platform `/v1/score`. Raises on any transport/HTTP error."""
    base_url = os.getenv("ML_PLATFORM_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("ML_PLATFORM_BASE_URL is not set")
    api_key = os.getenv("ML_PLATFORM_API_KEY", "").strip()
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    run_id = payload.get("pipeline_run_id")
    if run_id:
        headers["X-Run-Id"] = str(run_id)
    timeout = float(os.getenv("ML_PLATFORM_TIMEOUT_SEC", "35"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{base_url}/v1/score", json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _score_v0(result: Dict[str, Any], merged_profile: Dict[str, Any]) -> Dict[str, Any]:
    """Wrap calibrate_score and map additively into the resilience shape."""
    from services.score_calibration import calibrate_score

    result = calibrate_score(result, merged_profile=merged_profile or {})
    base = int(round(float(result.get("profile_score") or 0)))
    result["resilience_score"] = base
    result["readiness_score"] = base
    result["risk_score"] = 100 - base
    result["resilience_percentile"] = None
    result["readiness_percentile"] = None
    result["shap_attribution"] = []
    result["scoring_version"] = "v0"
    return result


def _apply_v1(result: Dict[str, Any], scored: Dict[str, Any]) -> Dict[str, Any]:
    """Merge an ML-platform v1 response onto the result dict."""
    resilience = int(round(float(scored.get("resilience_score", 0))))
    readiness = int(round(float(scored.get("readiness_score", 0))))
    result["resilience_score"] = resilience
    result["readiness_score"] = readiness
    result["risk_score"] = 100 - readiness
    result["resilience_percentile"] = scored.get("resilience_percentile")
    result["readiness_percentile"] = scored.get("readiness_percentile")
    result["shap_attribution"] = scored.get("shap_attribution") or []
    if scored.get("dimension_scores"):
        result["dimension_scores"] = scored["dimension_scores"]
    if scored.get("risk_band"):
        result["risk_band"] = scored["risk_band"]
    result["model_version"] = scored.get("model_version")
    result["scoring_version"] = "v1"
    return result


async def score_profile(
    result: Dict[str, Any],
    merged_profile: Dict[str, Any],
    survey_responses: Optional[Dict[str, Any]] = None,
    user_context: Optional[Dict[str, Any]] = None,
    pipeline_run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Score a profile, preferring the ML platform with a safe v0 fallback."""
    if _platform_enabled():
        payload = {
            "pipeline_run_id": pipeline_run_id,
            "canonical_profile": merged_profile or {},
            "survey_responses": survey_responses or {},
            "user_context": user_context or {},
            "include_explain": True,
        }
        try:
            scored = await _call_ml_platform(payload)
            return _apply_v1(result, scored)
        except Exception as exc:  # noqa: BLE001 — never fail the pipeline
            logger.warning("ml_platform_failed_falling_back_to_v0 error=%s", str(exc))

    return _score_v0(result, merged_profile)
