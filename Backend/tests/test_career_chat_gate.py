"""Tests for services.career_chat_gate — free users get FREE_CHAT_MESSAGE_LIMIT
messages, then 402. Premium unlimited; anonymous untracked."""

from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _user(active=False, used=0):
    expires = datetime.now(timezone.utc) + timedelta(days=30) if active else None
    return types.SimpleNamespace(
        id="u1",
        subscription_status="active" if active else "trial",
        subscription_expires_at=expires,
        subscription_tier="pro" if active else "free",
        career_chat_messages_used=used,
    )


class TestFreeChatMessageLimit:
    def test_default_is_five(self, monkeypatch):
        from services import career_chat_gate

        monkeypatch.delenv("FREE_CHAT_MESSAGE_LIMIT", raising=False)
        assert career_chat_gate.free_chat_message_limit() == 5

    def test_reads_env(self, monkeypatch):
        from services import career_chat_gate

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "3")
        assert career_chat_gate.free_chat_message_limit() == 3

    def test_invalid_env_falls_back(self, monkeypatch):
        from services import career_chat_gate

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "not-a-number")
        assert career_chat_gate.free_chat_message_limit() == 5


class TestEnforceCareerChatGate:
    def test_premium_always_allowed(self, monkeypatch):
        from services.career_chat_gate import enforce_career_chat_gate

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "5")
        enforce_career_chat_gate(_user(active=True, used=99))  # no raise

    def test_free_under_limit_allowed(self, monkeypatch):
        from services.career_chat_gate import enforce_career_chat_gate

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "5")
        enforce_career_chat_gate(_user(active=False, used=4))  # 5th message ok

    def test_free_at_limit_blocked(self, monkeypatch):
        from services.career_chat_gate import enforce_career_chat_gate

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "5")
        with pytest.raises(HTTPException) as exc:
            enforce_career_chat_gate(_user(active=False, used=5))
        assert exc.value.status_code == 402
        assert exc.value.detail["code"] == "premium_required"

    def test_anonymous_allowed(self):
        from services.career_chat_gate import enforce_career_chat_gate

        enforce_career_chat_gate(None)  # no raise — can't track, don't block


class TestShouldMarkUsed:
    def test_true_for_free_under_limit(self, monkeypatch):
        from services.career_chat_gate import should_mark_used

        monkeypatch.setenv("FREE_CHAT_MESSAGE_LIMIT", "5")
        assert should_mark_used(_user(active=False, used=0)) is True

    def test_false_for_premium(self):
        from services.career_chat_gate import should_mark_used

        assert should_mark_used(_user(active=True, used=0)) is False

    def test_false_for_none(self):
        from services.career_chat_gate import should_mark_used

        assert should_mark_used(None) is False
