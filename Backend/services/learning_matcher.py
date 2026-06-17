"""Learning Resource Matcher — matches skill gaps to curated learning resources."""

from __future__ import annotations

import json
import logging
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_CATALOG: List[Dict[str, Any]] = []


def _load_catalog() -> List[Dict[str, Any]]:
    """Load the learning resources catalog from JSON (cached in module)."""
    global _CATALOG
    if _CATALOG:
        return _CATALOG
    catalog_path = Path(__file__).resolve().parent.parent / "Data" / "learning_resources.json"
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            _CATALOG = json.load(f)
    except Exception:
        logger.warning("Failed to load learning resources catalog", exc_info=True)
        _CATALOG = []
    return _CATALOG


def _fuzzy_match(query: str, target: str, threshold: float = 0.55) -> float:
    """Return similarity ratio if above threshold, else 0."""
    q = query.lower().strip()
    t = target.lower().strip()
    # Exact substring match gets high score
    if q in t or t in q:
        return 1.0
    ratio = SequenceMatcher(None, q, t).ratio()
    return ratio if ratio >= threshold else 0.0


def match_resources(
    skill_gaps: List[Dict[str, Any]],
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Match learning resources to skill gaps.

    Args:
        skill_gaps: list of dicts with at least a 'name' key (skill name).
                    Optionally 'proficiency' and 'marketDemand' for weighting.
        limit: max resources to return.

    Returns:
        list of resource dicts with added 'relevance_score' and 'matched_skills'.
    """
    catalog = _load_catalog()
    if not catalog or not skill_gaps:
        return []

    # Normalize gap skill names
    gap_names = []
    gap_weights: Dict[str, float] = {}
    for gap in skill_gaps:
        name = (gap.get("name") or "").strip()
        if not name:
            continue
        gap_names.append(name)
        # Weight by demand - proficiency gap (higher gap = more relevant)
        demand = gap.get("marketDemand") or gap.get("market_demand") or 3
        proficiency = gap.get("proficiency") or 3
        gap_weights[name.lower()] = max(0.5, (demand - proficiency) / 5 + 0.5)

    if not gap_names:
        return []

    scored_resources: List[Dict[str, Any]] = []

    for resource in catalog:
        skills_covered = resource.get("skills_covered", [])
        matched_skills: List[str] = []
        total_score = 0.0

        for gap_name in gap_names:
            best_match_score = 0.0
            for covered_skill in skills_covered:
                match_score = _fuzzy_match(gap_name, covered_skill)
                if match_score > best_match_score:
                    best_match_score = match_score
            if best_match_score > 0:
                weight = gap_weights.get(gap_name.lower(), 0.5)
                total_score += best_match_score * weight
                matched_skills.append(gap_name)

        if matched_skills:
            # Bonus for rating
            rating_bonus = (resource.get("rating", 4.0) - 4.0) * 0.2
            final_score = round(total_score + rating_bonus, 3)
            scored_resources.append({
                **resource,
                "relevance_score": final_score,
                "matched_skills": matched_skills,
            })

    # Sort by relevance descending, then rating descending
    scored_resources.sort(key=lambda r: (-r["relevance_score"], -(r.get("rating") or 0)))

    return scored_resources[:limit]


def get_all_resources() -> List[Dict[str, Any]]:
    """Return the full catalog."""
    return _load_catalog()
