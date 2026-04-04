"""Tests for health / readiness endpoints."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_ready_returns_200(client):
    resp = await client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "ai_client" in data


@pytest.mark.asyncio
async def test_mcp_health_returns_ok(client):
    resp = await client.get("/mcp/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
