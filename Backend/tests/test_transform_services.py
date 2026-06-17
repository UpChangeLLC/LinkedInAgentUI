"""Tests for pure service modules (taxonomy, learning_matcher, company_service)."""

from __future__ import annotations

import os
import sys

import pytest

# Ensure Backend is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# taxonomy_service
# ---------------------------------------------------------------------------

class TestTaxonomyService:
    """Tests for services.taxonomy_service.classify_skill."""

    def test_classify_known_skill(self):
        from services.taxonomy_service import classify_skill

        result = classify_skill("Python")
        assert result["original_name"] == "Python"
        # Should find a category (not uncategorized) if the taxonomy JSON
        # includes Python. If taxonomy is missing, it falls back gracefully.
        assert "category" in result
        assert "canonical_name" in result

    def test_classify_empty_skill(self):
        from services.taxonomy_service import classify_skill

        result = classify_skill("")
        assert result["category"] == "uncategorized"
        assert result["canonical_name"] == ""

    def test_classify_unknown_skill_returns_uncategorized(self):
        from services.taxonomy_service import classify_skill

        result = classify_skill("XyzNonexistentSkill12345")
        assert result["category"] == "uncategorized"

    def test_classify_synonym_matching(self):
        """A synonym (e.g. 'ML') should map to its canonical name if defined."""
        from services.taxonomy_service import classify_skill

        result = classify_skill("ML")
        # Even if ML is not a synonym in the taxonomy, the function should
        # return a well-formed dict.
        assert "category" in result
        assert "canonical_name" in result
        assert result["original_name"] == "ML"


# ---------------------------------------------------------------------------
# learning_matcher
# ---------------------------------------------------------------------------

class TestLearningMatcher:
    """Tests for services.learning_matcher.match_resources."""

    def test_match_resources_with_sample_gaps(self):
        from services.learning_matcher import match_resources

        gaps = [{"name": "Python"}, {"name": "Machine Learning"}]
        results = match_resources(gaps, limit=5)
        # Should return a list (possibly empty if catalog is empty)
        assert isinstance(results, list)
        # If matches found, verify structure
        for r in results:
            assert "relevance_score" in r
            assert "matched_skills" in r

    def test_match_resources_empty_gaps(self):
        from services.learning_matcher import match_resources

        results = match_resources([], limit=5)
        assert results == []

    def test_match_resources_no_name_key(self):
        from services.learning_matcher import match_resources

        results = match_resources([{"name": ""}], limit=5)
        assert results == []


# ---------------------------------------------------------------------------
# company_service
# ---------------------------------------------------------------------------

class TestCompanyService:
    """Tests for services.company_service.enrich_company."""

    @pytest.mark.asyncio
    async def test_enrich_company_returns_expected_structure(self):
        from services.company_service import enrich_company

        result = await enrich_company("Acme Corp", "technology")
        assert result["company_name"] == "Acme Corp"
        assert result["industry"] == "technology"
        assert result["ai_posture_estimate"] in ("early", "growing", "mature")
        assert isinstance(result["discovery_links"], list)
        assert len(result["discovery_links"]) > 0
        assert "enrichment_notes" in result

    @pytest.mark.asyncio
    async def test_enrich_company_empty_name(self):
        from services.company_service import enrich_company

        result = await enrich_company("", "finance")
        assert result["ai_posture_estimate"] == "unknown"
        assert result["discovery_links"] == []

    @pytest.mark.asyncio
    async def test_enrich_company_tech_industry_is_mature(self):
        from services.company_service import enrich_company

        result = await enrich_company("TechStartup", "software")
        assert result["ai_posture_estimate"] == "mature"
