"""Tests for services.rerun_gate — the 30-day free re-run cadence.

Keyed on user_signups.id (not url_hash) so URL re-encoding can't bypass it.
Disabled when RERUN_GATE_DAYS=0; premium subscribers always bypass.
"""

from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _user(active=False):
    expires = datetime.now(timezone.utc) + timedelta(days=30) if active else None
    return types.SimpleNamespace(
        id="u1",
        subscription_status="active" if active else "trial",
        subscription_expires_at=expires,
    )


@pytest.mark.asyncio
class TestCanUserRerun:
    async def test_disabled_when_zero_days(self):
        import services.rerun_gate as gate

        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "0"}):
            ok, nxt = await gate.can_user_rerun(_user())
        assert ok is True and nxt is None

    async def test_no_prior_run_allowed(self):
        import services.rerun_gate as gate

        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "30"}):
            with patch.object(gate, "_latest_run_at", return_value=None):
                ok, nxt = await gate.can_user_rerun(_user())
        assert ok is True and nxt is None

    async def test_recent_run_locked(self):
        import services.rerun_gate as gate

        recent = datetime.now(timezone.utc) - timedelta(days=5)
        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "30"}):
            with patch.object(gate, "_latest_run_at", return_value=recent):
                ok, nxt = await gate.can_user_rerun(_user())
        assert ok is False
        assert nxt is not None and nxt > datetime.now(timezone.utc)

    async def test_old_run_allowed(self):
        import services.rerun_gate as gate

        old = datetime.now(timezone.utc) - timedelta(days=31)
        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "30"}):
            with patch.object(gate, "_latest_run_at", return_value=old):
                ok, nxt = await gate.can_user_rerun(_user())
        assert ok is True

    async def test_premium_bypasses(self):
        import services.rerun_gate as gate

        recent = datetime.now(timezone.utc) - timedelta(days=1)
        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "30"}):
            with patch.object(gate, "_latest_run_at", return_value=recent):
                ok, nxt = await gate.can_user_rerun(_user(active=True))
        assert ok is True and nxt is None

    async def test_none_user_allowed(self):
        import services.rerun_gate as gate

        with patch.dict(os.environ, {"RERUN_GATE_DAYS": "30"}):
            ok, nxt = await gate.can_user_rerun(None)
        assert ok is True and nxt is None
