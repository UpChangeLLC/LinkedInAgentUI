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


@pytest.mark.asyncio
async def test_get_funnel_db_graceful_shape(client):
    """GET /api/funnel degrades to zeroed counts when the DB is unavailable.

    The test suite runs with DATABASE_URL="" so this exercises the no-DB path:
    all 5 stages present with count 0 and rates None (0 denominators)."""
    from routes.stats import FUNNEL_STAGES

    resp = await client.get("/api/funnel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["window_days"] == 30
    stages = {s["stage"]: s["count"] for s in data["stages"]}
    assert list(stages.keys()) == FUNNEL_STAGES
    assert all(c == 0 for c in stages.values())
    # Zero denominators -> None rates, never a divide-by-zero.
    assert data["rates"]["survey_completion_rate"] is None
    assert data["rates"]["signup_conversion_rate"] is None
    assert data["rates"]["intake_to_signup_rate"] is None


@pytest.mark.asyncio
async def test_get_funnel_clamps_window(client):
    """`days` is clamped to [1, 365] to bound the query window."""
    assert (await client.get("/api/funnel?days=9999")).json()["window_days"] == 365
    assert (await client.get("/api/funnel?days=0")).json()["window_days"] == 1
