"""Pure Stripe webhook state-transition logic (no DB, no I/O).

``apply_subscription_event`` is the single place that decides how a Stripe event
moves a user between Free and Pro. Keeping it pure makes the billing rules fully
unit-testable; ``routes/stripe_webhooks.py`` handles signature verification,
idempotency, loading the user, and committing.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

# Stripe subscription statuses that mean the user currently has access.
_ACTIVE_STATUSES = {"active", "trialing"}
# Statuses that mean access has ended.
_DEAD_STATUSES = {"canceled", "unpaid", "incomplete_expired"}

# Fallback access window if an activation event carries no period end.
_DEFAULT_PERIOD_DAYS = 31


def _to_datetime(ts: Optional[int]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _period_end(data: Dict[str, Any]) -> Optional[datetime]:
    """Extract a period-end datetime from a subscription or invoice object."""
    end = _to_datetime(data.get("current_period_end"))
    if end:
        return end
    # invoice objects carry the period under lines.data[].period.end
    try:
        lines = (data.get("lines") or {}).get("data") or []
        if lines:
            return _to_datetime((lines[0].get("period") or {}).get("end"))
    except (AttributeError, IndexError, TypeError):
        pass
    return None


def _activate(user: Any, data: Dict[str, Any]) -> bool:
    expires = _period_end(data) or (datetime.now(timezone.utc) + timedelta(days=_DEFAULT_PERIOD_DAYS))
    user.subscription_status = "active"
    user.subscription_tier = "pro"
    user.subscription_expires_at = expires
    return True


def _deactivate(user: Any) -> bool:
    user.subscription_status = "canceled"
    user.subscription_tier = "free"
    return True


def apply_subscription_event(user: Any, event_type: str, data: Dict[str, Any]) -> bool:
    """Mutate ``user`` for a Stripe ``event_type``; return True if changed.

    Activation: checkout completion, an active subscription, or a paid invoice.
    Deactivation: subscription deleted or moved to a dead status. Payment
    failures are intentionally NOT immediate downgrades — Stripe retries, and a
    terminal failure arrives later as ``customer.subscription.updated/deleted``.
    """
    data = data or {}

    if event_type in ("checkout.session.completed", "invoice.paid"):
        return _activate(user, data)

    if event_type == "customer.subscription.deleted":
        return _deactivate(user)

    if event_type == "customer.subscription.updated":
        status = (data.get("status") or "").lower()
        if status in _ACTIVE_STATUSES:
            return _activate(user, data)
        if status in _DEAD_STATUSES:
            return _deactivate(user)
        return False  # e.g. past_due — wait for the terminal event

    return False
