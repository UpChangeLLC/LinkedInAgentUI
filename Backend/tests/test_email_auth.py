"""Tests for services.email_auth — one-time token make/verify for email
verification and password reset (constant-time, expiring, single-use)."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestMakeToken:
    def test_tokens_are_long_and_unique(self):
        from services.email_auth import make_token

        a, b = make_token(), make_token()
        assert a != b
        assert len(a) >= 32

    def test_hash_is_stable_and_64_hex(self):
        from services.auth_service import hash_token
        from services.email_auth import make_token

        token = make_token()
        h = hash_token(token)
        assert h == hash_token(token)
        assert len(h) == 64


class TestTokenExpiry:
    def test_expiry_is_in_the_future(self):
        from services.email_auth import token_expiry

        exp = token_expiry(hours=24)
        assert exp > datetime.now(timezone.utc)


class TestVerifyToken:
    def _setup(self, hours=1):
        from services.auth_service import hash_token
        from services.email_auth import make_token, token_expiry

        token = make_token()
        return token, hash_token(token), token_expiry(hours=hours)

    def test_valid_token_passes(self):
        from services.email_auth import verify_token

        token, h, exp = self._setup()
        assert verify_token(token, h, exp) is True

    def test_wrong_token_fails(self):
        from services.email_auth import verify_token

        _, h, exp = self._setup()
        assert verify_token("not-the-token", h, exp) is False

    def test_expired_token_fails(self):
        from services.auth_service import hash_token
        from services.email_auth import make_token, verify_token

        token = make_token()
        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        assert verify_token(token, hash_token(token), past) is False

    def test_naive_expiry_is_treated_as_utc(self):
        from services.auth_service import hash_token
        from services.email_auth import make_token, verify_token

        token = make_token()
        naive_future = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(tzinfo=None)
        assert verify_token(token, hash_token(token), naive_future) is True

    def test_missing_pieces_fail(self):
        from services.email_auth import verify_token

        token, h, exp = self._setup()
        assert verify_token("", h, exp) is False
        assert verify_token(token, None, exp) is False
        assert verify_token(token, h, None) is False
