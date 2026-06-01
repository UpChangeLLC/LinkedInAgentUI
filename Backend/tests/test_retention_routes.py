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


@pytest.mark.asyncio
async def test_cohort_forming_without_db(client):
    resp = await client.get("/api/community-insights/cohort?role=Product%20Manager&user_score=70")
    assert resp.status_code == 200
    body = resp.json()
    assert body["forming"] is True
    assert body["cohort_size"] == 0


@pytest.mark.asyncio
async def test_get_preferences_defaults_without_db(client):
    resp = await client.get("/api/notifications/preferences")
    assert resp.status_code == 200
    body = resp.json()
    assert body["score_updates"] is True
    assert body["reassessment_reminders"] is True


@pytest.mark.asyncio
async def test_patch_preferences_ok_without_db(client):
    resp = await client.patch("/api/notifications/preferences", json={"product_tips": False})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_email_webhook_accepts_open(client):
    resp = await client.post("/api/email/webhook", json={"RecordType": "Open", "Tag": "welcome"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
