"""Branch tests for the email-verification + password-reset routes.

Run against the DB-unavailable posture (no real Postgres in the suite), so they
cover validation and the no-enumeration / graceful-degradation branches. The
token-hash logic itself is covered by test_email_auth.py.
"""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_request_password_reset_always_ok_even_without_db(client):
    """No account enumeration: a reset request returns 200 regardless."""
    resp = await client.post(
        "/api/signup/request-password-reset", json={"email": "nobody@example.com"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_request_password_reset_rejects_bad_email(client):
    resp = await client.post(
        "/api/signup/request-password-reset", json={"email": "not-an-email"}
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_rejects_weak_password(client):
    """Password long enough for Pydantic but missing a digit → handler 400."""
    resp = await client.post(
        "/api/signup/reset-password", json={"token": "x" * 32, "new_password": "abcdefgh"}
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_without_db_is_unavailable(client):
    resp = await client.post("/api/signup/verify-email", json={"token": "x" * 32})
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_resend_verification_without_db_is_unavailable(client):
    resp = await client.post(
        "/api/signup/resend-verification", json={"access_token": "x" * 32}
    )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_oauth_endpoints_are_removed(client):
    """Social sign-in routes no longer exist (404, or 405 where the SPA GET
    catch-all owns the path for non-GET methods)."""
    assert (await client.get("/api/signup/oauth/start/google")).status_code in (404, 405)
    assert (await client.post("/api/signup/oauth/complete", json={})).status_code in (404, 405)
