"""Tests for services.apify_adapters — per-actor output normalization.

The adapter sits between an Apify actor's raw output and the canonical profile
shape consumed by ai_backend.py / agent.py / score_calibration.py. The canonical
shape is the legacy `supreme_coder` shape, so:
  - supreme_coder output passes through unchanged
  - dev_fusion output is remapped field-by-field to the canonical shape

The dev_fusion sample below mirrors the documented dev_fusion schema (doc 04).
Replace with real captured output from the Phase 0 smoke test when available.
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


DEV_FUSION_ACTOR = "dev_fusion/linkedin-profile-scraper"
SUPREME_ACTOR = "supreme_coder/linkedin-profile-scraper"


def _dev_fusion_sample() -> dict:
    """A representative dev_fusion raw payload (doc 04 field shapes)."""
    return {
        "fullName": "Pawas Gupta",
        "firstName": "Pawas",
        "lastName": "Gupta",
        "headline": "Senior Product Manager at Acme",
        "about": "Building AI products.",
        "email": "pawas@example.com",
        "experiences": [
            {
                "companyName": "Acme",
                "title": "Senior Product Manager",
                "jobStartedOn": "2021",
                "jobEndedOn": "",
                "jobDescription": "Led AI roadmap.",
                "jobLocation": "San Francisco, CA",
                "companyIndustry": "Software",
                "companySize": "1001-5000",
            }
        ],
        "educations": [
            {
                "schoolName": "MIT",
                "degree": "BS",
                "fieldOfStudy": "Computer Science",
                "startedOn": "2012",
                "endedOn": "2016",
            }
        ],
        "skills": [{"title": "Product Management"}, {"title": "Python"}],
        "certifications": [{"name": "PMP"}],
        "languages": ["English"],
        "recommendations": [],
    }


class TestNormalizeDevFusion:
    def test_returns_all_canonical_keys(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())

        for key in (
            "name", "title", "headline", "summary", "location", "email",
            "experiences", "education", "skills", "certifications",
            "projects", "languages", "recommendations",
        ):
            assert key in result, f"missing canonical key: {key}"

    def test_maps_name_and_summary(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())
        assert result["name"] == "Pawas Gupta"
        assert result["title"] == "Senior Product Manager at Acme"
        assert result["summary"] == "Building AI products."

    def test_maps_experience_fields(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())
        exp = result["experiences"][0]
        assert exp["company"] == "Acme"
        assert exp["title"] == "Senior Product Manager"
        assert exp["start"] == "2021"
        assert exp["description"] == "Led AI roadmap."

    def test_derives_location_from_first_experience(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())
        assert result["location"] == "San Francisco, CA"

    def test_maps_education_plural_key(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())
        edu = result["education"][0]
        assert edu["school"] == "MIT"
        assert edu["field"] == "Computer Science"

    def test_normalizes_skills_to_name_dicts(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, _dev_fusion_sample())
        assert {"name": "Product Management"} in result["skills"]
        assert {"name": "Python"} in result["skills"]

    def test_empty_payload_no_keyerror(self):
        from services.apify_adapters import normalize_profile

        result = normalize_profile(DEV_FUSION_ACTOR, {})
        assert result["name"] == ""
        assert result["experiences"] == []
        assert result["education"] == []
        assert result["skills"] == []
        assert result["location"] == ""


class TestPassthrough:
    def test_supreme_coder_unchanged(self):
        from services.apify_adapters import normalize_profile

        legacy = {"name": "X", "experiences": [{"company": "Y"}], "skills": ["Z"]}
        result = normalize_profile(SUPREME_ACTOR, legacy)
        assert result == legacy

    def test_unknown_actor_passthrough(self):
        from services.apify_adapters import normalize_profile

        legacy = {"name": "X"}
        result = normalize_profile("some/other-actor", legacy)
        assert result == legacy
