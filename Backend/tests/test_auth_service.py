"""Tests for services.auth_service — consolidated auth primitives.

These were previously duplicated across routes/signup.py and routes/payments.py.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestHashToken:
    def test_stable_and_strips(self):
        from services.auth_service import hash_token

        assert hash_token("abc") == hash_token(" abc ")

    def test_distinct_tokens_distinct_hashes(self):
        from services.auth_service import hash_token

        assert hash_token("a") != hash_token("b")

    def test_is_sha256_hex(self):
        from services.auth_service import hash_token

        h = hash_token("token")
        assert len(h) == 64
        int(h, 16)  # hex-decodable


class TestPasswordRoundTrip:
    def test_hash_then_verify(self):
        from services.auth_service import hash_password, verify_password

        stored = hash_password("Sup3rSecret")
        assert verify_password("Sup3rSecret", stored) is True
        assert verify_password("wrong", stored) is False

    def test_verify_none_hash(self):
        from services.auth_service import verify_password

        assert verify_password("x", None) is False


class TestSubscriptionActive:
    def test_active_future_expiry(self):
        from services.auth_service import is_subscription_active

        future = datetime.now(timezone.utc) + timedelta(days=5)
        assert is_subscription_active("active", future) is True

    def test_expired(self):
        from services.auth_service import is_subscription_active

        past = datetime.now(timezone.utc) - timedelta(days=1)
        assert is_subscription_active("active", past) is False

    def test_non_active_status(self):
        from services.auth_service import is_subscription_active

        future = datetime.now(timezone.utc) + timedelta(days=5)
        assert is_subscription_active("trial", future) is False

    def test_no_expiry(self):
        from services.auth_service import is_subscription_active

        assert is_subscription_active("active", None) is False


class TestNewAccessToken:
    def test_unique_and_nonempty(self):
        from services.auth_service import new_access_token

        a, b = new_access_token(), new_access_token()
        assert a and b and a != b
