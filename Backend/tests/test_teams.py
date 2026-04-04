"""Tests for team challenge endpoints (/api/teams/...)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_create_team_missing_fields_returns_422(client):
    """POST /api/teams with missing required fields should return 422."""
    resp = await client.post("/api/teams", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_leaderboard_invalid_code_returns_error(client):
    """GET /api/teams/INVALID/leaderboard should return 404 or 503.

    Without a DB the 503 fires first. With a DB, 404 for unknown code.
    """
    resp = await client.get("/api/teams/INVALID/leaderboard")
    assert resp.status_code in (404, 503)
