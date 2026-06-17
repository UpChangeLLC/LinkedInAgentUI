"""Tests for stats and analytics endpoints (/api/stats, /api/benchmarks, /api/news-feed)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_get_stats_returns_valid_json(client):
    """GET /api/stats should return 200 with JSON body."""
    resp = await client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_assessments" in data


@pytest.mark.asyncio
async def test_get_benchmarks_without_params_returns_400(client):
    """GET /api/benchmarks with no role or industry should return 400."""
    resp = await client.get("/api/benchmarks")
    assert resp.status_code == 400
    data = resp.json()
    assert data.get("status") == "error"


@pytest.mark.asyncio
async def test_get_news_feed_returns_links(client):
    """GET /api/news-feed should return valid JSON with a links array."""
    resp = await client.get("/api/news-feed")
    assert resp.status_code == 200
    data = resp.json()
    assert "links" in data
    assert isinstance(data["links"], list)
    assert len(data["links"]) > 0
