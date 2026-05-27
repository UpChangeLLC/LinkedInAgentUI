"""Per-actor output normalizers.

Maps any supported Apify actor's raw output to the canonical profile shape
consumed by ai_backend.py / agent.py / score_calibration.py. The canonical
shape is the legacy ``supreme_coder`` shape, so that actor (and any unknown
actor) passes through unchanged; only actors with a divergent schema get a
dedicated adapter.

See doc 04 (Apify Actor Swap Plan) for the field-mapping table.
"""

from __future__ import annotations

from typing import Any, Dict


def normalize_profile(actor_id: str, raw: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch to the right adapter based on ``actor_id``.

    Returns the canonical profile dict. Unknown actors pass through unchanged.
    """
    if "dev_fusion" in (actor_id or ""):
        return _normalize_dev_fusion(raw or {})
    # Default = supreme_coder / passthrough (already canonical shape)
    return raw


def _normalize_dev_fusion(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Adapter for dev_fusion/linkedin-profile-scraper."""
    experiences = [
        {
            "company": exp.get("companyName", ""),
            "title": exp.get("title", ""),
            "start": exp.get("jobStartedOn", ""),
            "end": exp.get("jobEndedOn", "") or "",
            "description": exp.get("jobDescription", ""),
            "location": exp.get("jobLocation", ""),
            "industry": exp.get("companyIndustry", ""),
            "size": exp.get("companySize", ""),
        }
        for exp in (raw.get("experiences") or [])
    ]
    education = [
        {
            "school": edu.get("schoolName") or edu.get("school", ""),
            "degree": edu.get("degree", ""),
            "field": edu.get("fieldOfStudy") or edu.get("field", ""),
            "start": edu.get("startedOn", ""),
            "end": edu.get("endedOn", ""),
        }
        for edu in (raw.get("educations") or raw.get("education") or [])
    ]
    skill_names = [
        s if isinstance(s, str) else (s.get("title") or s.get("name", ""))
        for s in (raw.get("skills") or [])
    ]
    skills = [{"name": s} for s in skill_names if s]

    return {
        "name": raw.get("fullName")
        or " ".join(filter(None, [raw.get("firstName"), raw.get("lastName")])),
        "title": raw.get("headline", ""),
        "headline": raw.get("headline", ""),
        "summary": raw.get("about") or raw.get("summary", ""),
        "location": (experiences[0]["location"] if experiences else ""),
        "email": raw.get("email", ""),
        "experiences": experiences,
        "education": education,
        "skills": skills,
        "certifications": raw.get("certifications") or [],
        "projects": raw.get("projects") or [],
        "languages": raw.get("languages") or [],
        "recommendations": raw.get("recommendations") or [],
        "_raw_actor": "dev_fusion",
    }
