"""Tests for services.career_chat_gate — first-message-free then 402 (spec 03 §5.3)."""

from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _user(active=False, used=False):
    expires = datetime.now(timezone.utc) + timedelta(days=30) if active else None
    return types.SimpleNamespace(
        id="u1",
        subscription_status="active" if active else "trial",
        subscription_expires_at=expires,
        career_chat_free_used=used,
    )


class TestEnforceCareerChatGate:
    def test_premium_always_allowed(self):
        from services.career_chat_gate import enforce_career_chat_gate

        enforce_career_chat_gate(_user(active=True, used=True))  # no raise

    def test_free_first_message_allowed(self):
        from services.career_chat_gate import enforce_career_chat_gate

        enforce_career_chat_gate(_user(active=False, used=False))  # no raise

    def test_free_second_message_blocked(self):
        from services.career_chat_gate import enforce_career_chat_gate

        with pytest.raises(HTTPException) as exc:
            enforce_career_chat_gate(_user(active=False, used=True))
        assert exc.value.status_code == 402
        assert exc.value.detail["code"] == "premium_required"

    def test_anonymous_allowed(self):
        from services.career_chat_gate import enforce_career_chat_gate

        enforce_career_chat_gate(None)  # no raise — can't track, don't block


class TestShouldMarkUsed:
    def test_true_for_free_unused(self):
        from services.career_chat_gate import should_mark_used

        assert should_mark_used(_user(active=False, used=False)) is True

    def test_false_for_premium(self):
        from services.career_chat_gate import should_mark_used

        assert should_mark_used(_user(active=True, used=False)) is False

    def test_false_for_none(self):
        from services.career_chat_gate import should_mark_used

        assert should_mark_used(None) is False
