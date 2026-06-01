"""Tests for POST /api/signup/onboarding — the lighter mid-onboarding variant."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_onboarding_signup_returns_session_without_db(client):
    """With no DB configured (test env), returns ok + access_token, not persisted."""
    resp = await client.post(
        "/api/signup/onboarding",
        json={"full_name": "Pawas Gupta", "email": "p@example.com", "password": "GoodPass1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["access_token"]
    assert body["subscription_active"] is False


@pytest.mark.asyncio
async def test_onboarding_signup_rejects_bad_email(client):
    resp = await client.post(
        "/api/signup/onboarding",
        json={"full_name": "X", "email": "not-an-email", "password": "GoodPass1"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_onboarding_signup_rejects_weak_password(client):
    resp = await client.post(
        "/api/signup/onboarding",
        json={"full_name": "X", "email": "p@example.com", "password": "short"},
    )
    assert resp.status_code == 400
