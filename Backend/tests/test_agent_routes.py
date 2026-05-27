"""Tests for agent execution endpoints (/mcp/run, /mcp/preview, /mcp/run/stream)."""

from __future__ import annotations

import os
import types
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_mcp_run_missing_input_returns_400(client):
    """POST /mcp/run with empty linkedin_url and resume_text should return 400."""
    resp = await client.post("/mcp/run", json={"linkedin_url": "", "resume_text": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_mcp_preview_missing_input_returns_400(client):
    """POST /mcp/preview with empty inputs should return 400."""
    resp = await client.post("/mcp/preview", json={"linkedin_url": "", "resume_text": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_mcp_run_stream_missing_input_returns_400(client):
    """POST /mcp/run/stream with empty inputs should return 400."""
    resp = await client.post("/mcp/run/stream", json={"linkedin_url": "", "resume_text": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_mcp_run_with_valid_payload(client):
    """POST /mcp/run with a valid payload should return 200 when pipeline is mocked."""
    mock_result = {
        "profile_score": 72,
        "data_source": "mock",
        "overall_assessment": {"ai_readiness": "moderate"},
        "dimension_scores": {},
    }
    mock_trace = [
        {"step": "fetch", "success": True, "duration_ms": 100, "info": "ok"},
    ]

    with patch(
        "routes.agent.run_pipeline_with_trace",
        new_callable=AsyncMock,
        return_value=(mock_result, mock_trace),
    ), patch(
        "routes.agent._record_pipeline_run",
        new_callable=AsyncMock,
    ), patch(
        "routes.agent._compute_score_delta",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "routes.agent._store_assessment_history",
        new_callable=AsyncMock,
    ):
        resp = await client.post(
            "/mcp/run",
            json={
                "linkedin_url": "https://linkedin.com/in/testuser",
                "resume_text": "",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["data_source"] == "mock"
        assert data["result"]["profile_score"] == 72


@pytest.mark.asyncio
async def test_mcp_run_hard_gate_rejects_anonymous(client):
    """With ALLOW_ANON_RUN=false, /mcp/run without X-Session-Token returns 401."""
    with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false"}):
        resp = await client.post(
            "/mcp/run",
            json={"linkedin_url": "https://linkedin.com/in/testuser", "resume_text": ""},
        )
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "AUTH_REQUIRED"


@pytest.mark.asyncio
async def test_mcp_run_hard_gate_allows_valid_session(client):
    """With ALLOW_ANON_RUN=false, a valid X-Session-Token reaches the pipeline."""
    import auth_deps

    fake_user = types.SimpleNamespace(
        id=None, subscription_status="trial", subscription_expires_at=None
    )

    async def fake_lookup(token):
        return fake_user if token == "valid-token" else None

    mock_result = {"profile_score": 80, "data_source": "mock",
                   "overall_assessment": {}, "dimension_scores": {}}
    mock_trace = [{"step": "fetch", "success": True, "duration_ms": 1, "info": "ok"}]

    with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false", "RERUN_GATE_DAYS": "0"}), \
        patch.object(auth_deps, "_lookup_user_by_token", side_effect=fake_lookup), \
        patch("routes.agent.run_pipeline_with_trace", new_callable=AsyncMock,
              return_value=(mock_result, mock_trace)), \
        patch("routes.agent._record_pipeline_run", new_callable=AsyncMock), \
        patch("routes.agent._compute_score_delta", new_callable=AsyncMock, return_value=None), \
        patch("routes.agent._store_assessment_history", new_callable=AsyncMock):
        resp = await client.post(
            "/mcp/run",
            json={"linkedin_url": "https://linkedin.com/in/testuser", "resume_text": ""},
            headers={"X-Session-Token": "valid-token"},
        )
    assert resp.status_code == 200
    assert resp.json()["result"]["profile_score"] == 80
