"""Tests for auth_deps — the per-user session dependency (hard auth gate).

Identity rides the X-Session-Token header (NOT Authorization, which carries the
static MCP_API_KEY). The gate is itself flag-gated by ALLOW_ANON_RUN so it can
ship dark and be flipped at cutover.
"""

from __future__ import annotations

import os
import sys
import types
from unittest.mock import patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _req(token: str | None = None):
    headers = {}
    if token is not None:
        headers["X-Session-Token"] = token
    return types.SimpleNamespace(headers=headers)


@pytest.mark.asyncio
class TestRequireSession:
    async def test_gate_off_no_token_soft_passes(self):
        import auth_deps

        with patch.dict(os.environ, {"ALLOW_ANON_RUN": "true"}):
            user = await auth_deps.require_session(_req(None))
        assert user is None

    async def test_gate_on_no_token_raises_401(self):
        import auth_deps

        with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false"}):
            with pytest.raises(HTTPException) as exc:
                await auth_deps.require_session(_req(None))
        assert exc.value.status_code == 401

    async def test_gate_on_valid_token_returns_user(self):
        import auth_deps

        sentinel = types.SimpleNamespace(id="user-123")

        async def fake_lookup(token):
            return sentinel if token == "good" else None

        with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false"}):
            with patch.object(auth_deps, "_lookup_user_by_token", side_effect=fake_lookup):
                user = await auth_deps.require_session(_req("good"))
        assert user is sentinel

    async def test_gate_on_bad_token_raises_401(self):
        import auth_deps

        async def fake_lookup(token):
            return None

        with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false"}):
            with patch.object(auth_deps, "_lookup_user_by_token", side_effect=fake_lookup):
                with pytest.raises(HTTPException) as exc:
                    await auth_deps.require_session(_req("bad"))
        assert exc.value.status_code == 401


@pytest.mark.asyncio
class TestOptionalSession:
    async def test_never_raises_without_token(self):
        import auth_deps

        with patch.dict(os.environ, {"ALLOW_ANON_RUN": "false"}):
            user = await auth_deps.optional_session(_req(None))
        assert user is None
