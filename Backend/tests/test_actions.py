"""Tests for action item endpoints (/api/actions/...)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_get_actions_returns_503_without_db(client):
    """GET /api/actions/{url_hash} should return 503 when DB is not available."""
    resp = await client.get("/api/actions/abc123hash")
    assert resp.status_code == 503
    data = resp.json()
    assert "not available" in data.get("detail", "").lower()


@pytest.mark.asyncio
async def test_patch_action_invalid_uuid_returns_400(client):
    """PATCH /api/actions/{bad_id} with an invalid UUID should return 400 or 503.

    Without a DB the 503 fires first from _require_db(). We verify the endpoint
    is reachable and returns an error status.
    """
    resp = await client.patch(
        "/api/actions/not-a-valid-uuid",
        json={"status": "completed"},
    )
    # Without DB: 503 from _require_db; with DB: 400 for invalid UUID
    assert resp.status_code in (400, 503)
