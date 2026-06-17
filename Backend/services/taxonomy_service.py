"""Skill Taxonomy Mapping service (F8).

Loads skill taxonomy from JSON and classifies skills into categories
using exact match and fuzzy synonym matching.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "Data" / "skill_taxonomy.json"
_taxonomy_cache: Optional[Dict[str, Any]] = None
_lookup_cache: Optional[Dict[str, Dict[str, str]]] = None


def _load_taxonomy() -> Dict[str, Any]:
    """Load taxonomy JSON from disk, caching in memory."""
    global _taxonomy_cache
    if _taxonomy_cache is not None:
        return _taxonomy_cache
    try:
        raw = _TAXONOMY_PATH.read_text(encoding="utf-8")
        _taxonomy_cache = json.loads(raw)
    except FileNotFoundError:
        logger.error("Skill taxonomy file not found at %s", _TAXONOMY_PATH)
        _taxonomy_cache = {}
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON in skill taxonomy file: %s", exc)
        _taxonomy_cache = {}
    return _taxonomy_cache


def _build_lookup() -> Dict[str, Dict[str, str]]:
    """Build a flat lookup: normalized_name -> {canonical_name, category}.

    Includes both canonical skill names and their synonyms.
    """
    global _lookup_cache
    if _lookup_cache is not None:
        return _lookup_cache

    taxonomy = _load_taxonomy()
    lookup: Dict[str, Dict[str, str]] = {}

    for category, cat_data in taxonomy.items():
        if not isinstance(cat_data, dict):
            continue
        skills = cat_data.get("skills", {})
        if not isinstance(skills, dict):
            continue
        for canonical_name, synonyms in skills.items():
            normalized = canonical_name.strip().lower()
            lookup[normalized] = {
                "canonical_name": canonical_name,
                "category": category,
            }
            if isinstance(synonyms, list):
                for synonym in synonyms:
                    syn_normalized = synonym.strip().lower()
                    if syn_normalized and syn_normalized not in lookup:
                        lookup[syn_normalized] = {
                            "canonical_name": canonical_name,
                            "category": category,
                        }

    _lookup_cache = lookup
    return _lookup_cache


def classify_skill(skill_name: str) -> Dict[str, str]:
    """Classify a single skill name against the taxonomy.

    Returns {canonical_name, category, original_name}.
    Uses fuzzy matching: lowercase, strip whitespace, exact then synonym check.
    Returns category="uncategorized" if no match found.
    """
    original = (skill_name or "").strip()
    if not original:
        return {
            "canonical_name": "",
            "category": "uncategorized",
            "original_name": original,
        }

    lookup = _build_lookup()
    normalized = original.lower().strip()

    # Exact match (canonical or synonym)
    match = lookup.get(normalized)
    if match:
        return {
            "canonical_name": match["canonical_name"],
            "category": match["category"],
            "original_name": original,
        }

    # Try with common normalizations: remove hyphens, slashes
    for sep in ("-", "/", "_"):
        alt = normalized.replace(sep, " ").strip()
        match = lookup.get(alt)
        if match:
            return {
                "canonical_name": match["canonical_name"],
                "category": match["category"],
                "original_name": original,
            }

    # Try substring containment for short skill names (3+ chars)
    if len(normalized) >= 3:
        for key, val in lookup.items():
            if normalized == key or key == normalized:
                continue
            # Only match if the lookup key is contained in the input or vice versa
            # with reasonable length ratio to avoid false positives
            if len(key) >= 3 and (key in normalized or normalized in key):
                longer = max(len(key), len(normalized))
                shorter = min(len(key), len(normalized))
                if shorter / longer >= 0.6:
                    return {
                        "canonical_name": val["canonical_name"],
                        "category": val["category"],
                        "original_name": original,
                    }

    return {
        "canonical_name": original.lower(),
        "category": "uncategorized",
        "original_name": original,
    }


def classify_skills(skills: List[str]) -> List[Dict[str, str]]:
    """Batch classify a list of skill names.

    Returns a list of classification dicts, one per input skill.
    """
    return [classify_skill(skill) for skill in skills]


def reload_taxonomy() -> None:
    """Force reload of taxonomy data (useful for testing or hot-reload)."""
    global _taxonomy_cache, _lookup_cache
    _taxonomy_cache = None
    _lookup_cache = None
    _load_taxonomy()
    _build_lookup()
