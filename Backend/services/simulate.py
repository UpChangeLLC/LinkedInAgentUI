"""What-If simulator.

Applies scenario patches (add a certification / skill / AI project / move to an
AI-forward company) to the user's BASE profile + survey, then re-scores through
the existing ML seam (`services.ml_client.score_profile` → ML platform
`/v1/score`). The base profile is the already-normalized canonical LinkedIn
profile cached in apify_cache (`raw_data`), so a simulation costs no scrape and
no LLM — only the fast ML scoring call. The recompute is therefore *real*
(model-computed), not a hardcoded delta.
"""
from __future__ import annotations

import copy
import os
from typing import Any, Dict, List, Optional

from services.apify_cache_service import get_cached_dataset_any_age
from services.ml_client import score_profile


def apply_scenarios(
    profile: Optional[Dict[str, Any]],
    survey: Optional[Dict[str, Any]],
    user_context: Optional[Dict[str, Any]],
    scenarios: List[Dict[str, Any]],
) -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """Return deep-copied (profile, survey, user_context) with scenario patches
    applied. Pure — never mutates the inputs."""
    p = copy.deepcopy(profile or {})
    s = copy.deepcopy(survey or {})
    c = copy.deepcopy(user_context or {})
    p.setdefault("skills", [])
    p.setdefault("certifications", [])
    p.setdefault("experiences", [])

    for sc in scenarios or []:
        t = str(sc.get("type") or "").lower()
        v = sc.get("value")
        if t == "certification":
            p["certifications"].append(v or "AI/ML Certification")
            s["q_lv_1"] = "3-5"  # completed more courses/certs in the last year
        elif t in ("skill", "skill_custom"):
            vals = v if isinstance(v, list) else [v or "Python"]
            for sk in vals:
                if sk:
                    p["skills"].append(sk)
            s["q_lv_2"] = 5  # actively seeks out new skills (Likert max)
        elif t == "project":
            p["experiences"].insert(0, {
                "title": v or "AI Project Lead",
                "description": (
                    "Led an AI/ML initiative end-to-end with measurable, "
                    "quantified outcomes (deployed models, +revenue/efficiency)."
                ),
            })
        elif t == "company":
            c["industry"] = v or "Artificial Intelligence"
            p["industry"] = c["industry"]
    return p, s, c


async def simulate(
    linkedin_url: str,
    survey_responses: Optional[Dict[str, Any]] = None,
    user_context: Optional[Dict[str, Any]] = None,
    scenarios: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Re-score the profile with scenario patches applied. Returns
    {available, resilience_score, readiness_score, dimension_scores}."""
    base: Optional[Dict[str, Any]] = None
    try:
        # ai_backend owns URL normalization + the apify cache-key namespacing.
        from ai_backend import _linkedin_cache_key, normalize_linkedin_profile_url

        normalized = normalize_linkedin_profile_url(linkedin_url or "")
        if normalized:
            key = _linkedin_cache_key(normalized, os.getenv("APIFY_ACTOR_ID", ""))
            cached = await get_cached_dataset_any_age(key)
            if cached and isinstance(cached.get("raw_data"), dict):
                base = cached["raw_data"]
    except Exception:  # noqa: BLE001 — simulation is best-effort
        base = None

    if not isinstance(base, dict):
        return {
            "available": False,
            "resilience_score": None,
            "readiness_score": None,
            "dimension_scores": {},
        }

    profile, survey, ctx = apply_scenarios(base, survey_responses, user_context, scenarios or [])
    result = await score_profile({}, merged_profile=profile, survey_responses=survey, user_context=ctx)
    return {
        "available": True,
        "resilience_score": result.get("resilience_score"),
        "readiness_score": result.get("readiness_score"),
        "dimension_scores": result.get("dimension_scores", {}),
        "scoring_version": result.get("scoring_version"),
    }
