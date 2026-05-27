"""Tests for retention endpoints (trajectory + reminder)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_trajectory_returns_empty_without_db(client):
    resp = await client.get("/api/history/abc123/trajectory")
    assert resp.status_code == 200
    body = resp.json()
    assert body["history"] == []
    assert body["next_rerun_at"] is None


@pytest.mark.asyncio
async def test_set_rerun_reminder_ok_without_db(client):
    resp = await client.post("/api/notifications/set-rerun-reminder")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
