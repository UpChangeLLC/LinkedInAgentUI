"""Tests for the Apify fetch path: actor-aware run input, cache namespacing,
and primary→fallback behavior (Workstream 0)."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DEV_FUSION = "dev_fusion/linkedin-profile-scraper"
SUPREME = "supreme_coder/linkedin-profile-scraper"
URL = "https://www.linkedin.com/in/pawas-gupta/"


class TestBuildRunInput:
    def test_dev_fusion_shape(self):
        from ai_backend import _build_run_input

        assert _build_run_input(DEV_FUSION, URL) == {"profileUrls": [URL]}

    def test_supreme_coder_shape(self):
        from ai_backend import _build_run_input

        result = _build_run_input(SUPREME, URL)
        assert result["urls"] == [{"url": URL}]
        assert "findContacts.contactCompassToken" in result


class TestCacheKeyNamespacing:
    def test_actor_changes_key(self):
        from ai_backend import _linkedin_cache_key

        assert _linkedin_cache_key(URL, DEV_FUSION) != _linkedin_cache_key(URL, SUPREME)

    def test_no_actor_is_backward_compatible(self):
        from ai_backend import _linkedin_cache_key

        # Legacy callers passing only the URL must get the original hash.
        legacy = _linkedin_cache_key(URL)
        from hashlib import sha1

        expected = sha1(URL.strip().lower().rstrip("/").encode("utf-8")).hexdigest()
        assert legacy == expected


@pytest.mark.asyncio
class TestFallback:
    async def test_primary_failure_falls_back(self):
        from hashlib import sha1
        import ai_backend

        calls = []

        async def fake_fetch(url, actor_id):
            calls.append(actor_id)
            if actor_id == DEV_FUSION:
                raise RuntimeError("primary down")
            return '{"name": "fallback"}'

        with patch.dict(os.environ, {
            "APIFY_API_TOKEN": "tok",
            "APIFY_ACTOR_ID": DEV_FUSION,
            "APIFY_FALLBACK_ACTOR_ID": SUPREME,
            "APIFY_FALLBACK_ENABLED": "true",
        }):
            with patch.object(ai_backend, "_fetch_with_actor", side_effect=fake_fetch):
                result = await ai_backend.fetch_linkedin_via_apify(URL)

        assert calls == [DEV_FUSION, SUPREME]
        assert "fallback" in result

    async def test_fallback_disabled_raises(self):
        import ai_backend

        async def fake_fetch(url, actor_id):
            raise RuntimeError("primary down")

        with patch.dict(os.environ, {
            "APIFY_API_TOKEN": "tok",
            "APIFY_ACTOR_ID": DEV_FUSION,
            "APIFY_FALLBACK_ENABLED": "false",
        }):
            with patch.object(ai_backend, "_fetch_with_actor", side_effect=fake_fetch):
                with pytest.raises(RuntimeError):
                    await ai_backend.fetch_linkedin_via_apify(URL)
