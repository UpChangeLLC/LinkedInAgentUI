"""Tests for career-chat session helpers — auto-title + ownership (IDOR guard)."""

from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestDeriveTitle:
    def test_short_message_is_the_title(self):
        from services.career_chat_sessions import derive_title

        assert derive_title("Help me pivot to AI PM") == "Help me pivot to AI PM"

    def test_long_message_is_truncated_with_ellipsis(self):
        from services.career_chat_sessions import derive_title

        title = derive_title("x" * 200)
        assert len(title) <= 51  # 48 chars + ellipsis
        assert title.endswith("…")

    def test_whitespace_is_collapsed(self):
        from services.career_chat_sessions import derive_title

        assert derive_title("  hello\n\n  world  ") == "hello world"

    def test_empty_falls_back_to_new_chat(self):
        from services.career_chat_sessions import derive_title

        assert derive_title("   ") == "New chat"
        assert derive_title("") == "New chat"


class TestOwnsSession:
    def test_no_row_is_allowed_anon_or_legacy(self):
        from services.career_chat_sessions import owns_session

        # No session row exists for this sid (anonymous / pre-existing) → allow.
        assert owns_session(types.SimpleNamespace(id="u1"), None) is True
        assert owns_session(None, None) is True

    def test_owner_can_access(self):
        from services.career_chat_sessions import owns_session

        row = types.SimpleNamespace(user_signup_id="u1")
        assert owns_session(types.SimpleNamespace(id="u1"), row) is True

    def test_non_owner_is_denied(self):
        from services.career_chat_sessions import owns_session

        row = types.SimpleNamespace(user_signup_id="owner")
        assert owns_session(types.SimpleNamespace(id="attacker"), row) is False

    def test_anonymous_cannot_access_owned_session(self):
        from services.career_chat_sessions import owns_session

        row = types.SimpleNamespace(user_signup_id="owner")
        assert owns_session(None, row) is False
