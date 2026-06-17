"""Tests for LinkedIn OAuth transport routes."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


class _MockResponse:
    def __init__(self, *, is_success: bool, status_code: int = 200, payload=None, text: str = ""):
        self.is_success = is_success
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


@pytest.mark.asyncio
async def test_auth_linkedin_is_public_even_with_api_key(client, monkeypatch):
    """OAuth start route should not be blocked by MCP_API_KEY middleware."""
    monkeypatch.setenv("MCP_API_KEY", "test-secret")
    resp = await client.get("/auth/linkedin")
    # Not configured => 503 is expected, but it must never be 401 here.
    assert resp.status_code != 401


@pytest.mark.asyncio
async def test_auth_linkedin_redirects_to_linkedin_when_configured(client, monkeypatch):
    monkeypatch.setenv("LINKEDIN_CLIENT_ID", "client-id")
    monkeypatch.setenv("LINKEDIN_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("BACKEND_URL", "http://testserver")

    with patch("routes.auth.cache_set", new_callable=AsyncMock, return_value=True):
        resp = await client.get("/auth/linkedin", follow_redirects=False)

    assert resp.status_code in (302, 307)
    location = resp.headers.get("location", "")
    assert "linkedin.com/oauth/v2/authorization" in location
    assert "client_id=client-id" in location
    assert "state=" in location


@pytest.mark.asyncio
async def test_auth_callback_invalid_state_redirects_with_error(client):
    resp = await client.get("/auth/linkedin/callback?code=abc&state=bad", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert "linkedin_error=invalid_state" in (resp.headers.get("location") or "")


@pytest.mark.asyncio
async def test_auth_callback_success_redirects_with_linkedin_url(client, monkeypatch):
    monkeypatch.setenv("LINKEDIN_CLIENT_ID", "client-id")
    monkeypatch.setenv("LINKEDIN_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("BACKEND_URL", "http://testserver")

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        return_value=_MockResponse(
            is_success=True,
            payload={"access_token": "token-123"},
        )
    )
    mock_client.get = AsyncMock(
        side_effect=[
            _MockResponse(is_success=True, payload={"sub": "member-id"}),
            _MockResponse(is_success=True, payload={"vanityName": "test-user"}),
        ]
    )
    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_client
    mock_cm.__aexit__.return_value = False

    with patch("routes.auth.cache_get", new_callable=AsyncMock, return_value="1"), patch(
        "routes.auth.cache_delete", new_callable=AsyncMock
    ), patch("routes.auth.httpx.AsyncClient", return_value=mock_cm):
        resp = await client.get("/auth/linkedin/callback?code=abc&state=ok-state", follow_redirects=False)

    assert resp.status_code in (302, 307)
    location = resp.headers.get("location", "")
    assert "linkedin_url=" in location
    assert "oauth_profile_token=" in location
    assert "start_analysis=1" in location


@pytest.mark.asyncio
async def test_auth_callback_fallback_redirects_with_oauth_profile_token(client, monkeypatch):
    monkeypatch.setenv("LINKEDIN_CLIENT_ID", "client-id")
    monkeypatch.setenv("LINKEDIN_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("BACKEND_URL", "http://testserver")

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        return_value=_MockResponse(
            is_success=True,
            payload={"access_token": "token-123"},
        )
    )
    # userinfo succeeds, /v2/me fails -> fallback token path
    mock_client.get = AsyncMock(
        side_effect=[
            _MockResponse(is_success=True, payload={"sub": "member-id", "name": "Test User"}),
            _MockResponse(is_success=False, status_code=403, payload={}),
        ]
    )
    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_client
    mock_cm.__aexit__.return_value = False

    with patch("routes.auth.cache_get", new_callable=AsyncMock, return_value="1"), patch(
        "routes.auth.cache_delete", new_callable=AsyncMock
    ), patch("routes.auth.httpx.AsyncClient", return_value=mock_cm), patch(
        "routes.auth.cache_set_json", new_callable=AsyncMock, return_value=True
    ):
        resp = await client.get("/auth/linkedin/callback?code=abc&state=ok-state", follow_redirects=False)

    assert resp.status_code in (302, 307)
    location = resp.headers.get("location", "")
    assert "oauth_profile_token=" in location
    assert "start_analysis=1" in location


@pytest.mark.asyncio
async def test_auth_profile_token_endpoint_returns_payload(client):
    with patch(
        "routes.auth.cache_get_json",
        new_callable=AsyncMock,
        return_value={"provider": "linkedin", "userinfo": {"sub": "abc"}},
    ), patch("routes.auth.cache_delete", new_callable=AsyncMock):
        resp = await client.get("/auth/linkedin/profile/sample-token")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["profile"]["provider"] == "linkedin"
