"""Tests for services.entitlements — single source of truth for Pro gating.

With the Free/Pro model an active subscription IS Pro; ``subscription_tier`` is
persisted for clarity and future multi-tier support. Feature gates route through
``feature_allowed`` so there is one place that decides what Pro unlocks.
"""

from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _user(active=False, tier="free"):
    expires = datetime.now(timezone.utc) + timedelta(days=30) if active else None
    return types.SimpleNamespace(
        id="u1",
        subscription_status="active" if active else "trial",
        subscription_expires_at=expires,
        subscription_tier=tier,
    )


def _expired_user(tier="pro"):
    return types.SimpleNamespace(
        id="u2",
        subscription_status="active",
        subscription_expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        subscription_tier=tier,
    )


class TestHasPro:
    def test_anonymous_is_not_pro(self):
        from services.entitlements import has_pro

        assert has_pro(None) is False

    def test_active_subscription_is_pro(self):
        from services.entitlements import has_pro

        assert has_pro(_user(active=True, tier="pro")) is True

    def test_trial_user_is_not_pro(self):
        from services.entitlements import has_pro

        assert has_pro(_user(active=False)) is False

    def test_expired_subscription_is_not_pro(self):
        from services.entitlements import has_pro

        assert has_pro(_expired_user()) is False


class TestFeatureAllowed:
    def test_unknown_feature_is_free_for_everyone(self):
        from services.entitlements import feature_allowed

        assert feature_allowed(None, "some_free_feature") is True

    def test_pro_feature_blocked_for_anonymous(self):
        from services.entitlements import feature_allowed

        assert feature_allowed(None, "career_chat_sessions") is False

    def test_pro_feature_blocked_for_free_user(self):
        from services.entitlements import feature_allowed

        assert feature_allowed(_user(active=False), "career_chat_sessions") is False

    def test_pro_feature_allowed_for_active_subscriber(self):
        from services.entitlements import feature_allowed

        assert feature_allowed(_user(active=True, tier="pro"), "career_chat_sessions") is True
