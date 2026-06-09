"""Tests for the pure Stripe webhook state-transition logic.

These run without a DB or async loop: ``apply_subscription_event`` mutates a
plain user object so the activation/cancellation rules are fully unit-tested
here; the route layer only wires signature verification + idempotency + commit.
"""

from __future__ import annotations

import os
import sys
import types
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _user(status="trial", tier="free", expires=None):
    return types.SimpleNamespace(
        id="u1",
        subscription_status=status,
        subscription_tier=tier,
        subscription_expires_at=expires,
    )


def _period_end_ts(days=30):
    return int((datetime.now(timezone.utc) + timedelta(days=days)).timestamp())


class TestApplySubscriptionEvent:
    def test_checkout_completed_activates_pro(self):
        from services.stripe_events import apply_subscription_event

        user = _user()
        changed = apply_subscription_event(
            user, "checkout.session.completed", {"current_period_end": _period_end_ts(30)}
        )
        assert changed is True
        assert user.subscription_status == "active"
        assert user.subscription_tier == "pro"
        assert user.subscription_expires_at > datetime.now(timezone.utc)

    def test_subscription_updated_active_grants_pro(self):
        from services.stripe_events import apply_subscription_event

        user = _user()
        changed = apply_subscription_event(
            user, "customer.subscription.updated", {"status": "active", "current_period_end": _period_end_ts(30)}
        )
        assert changed is True
        assert user.subscription_tier == "pro"
        assert user.subscription_status == "active"

    def test_subscription_deleted_downgrades_to_free(self):
        from services.stripe_events import apply_subscription_event

        user = _user(status="active", tier="pro", expires=datetime.now(timezone.utc) + timedelta(days=10))
        changed = apply_subscription_event(user, "customer.subscription.deleted", {})
        assert changed is True
        assert user.subscription_tier == "free"
        assert user.subscription_status != "active"

    def test_subscription_updated_canceled_downgrades(self):
        from services.stripe_events import apply_subscription_event

        user = _user(status="active", tier="pro")
        changed = apply_subscription_event(user, "customer.subscription.updated", {"status": "canceled"})
        assert changed is True
        assert user.subscription_tier == "free"

    def test_invoice_paid_extends_pro(self):
        from services.stripe_events import apply_subscription_event

        user = _user(status="active", tier="pro")
        changed = apply_subscription_event(
            user, "invoice.paid", {"lines": {"data": [{"period": {"end": _period_end_ts(60)}}]}}
        )
        assert changed is True
        assert user.subscription_tier == "pro"

    def test_payment_failed_does_not_immediately_downgrade(self):
        from services.stripe_events import apply_subscription_event

        user = _user(status="active", tier="pro")
        changed = apply_subscription_event(user, "invoice.payment_failed", {})
        assert changed is False
        assert user.subscription_tier == "pro"  # Stripe retries; downgrade only on subscription.updated/deleted

    def test_unknown_event_is_noop(self):
        from services.stripe_events import apply_subscription_event

        user = _user(status="active", tier="pro")
        changed = apply_subscription_event(user, "customer.created", {})
        assert changed is False
        assert user.subscription_tier == "pro"
