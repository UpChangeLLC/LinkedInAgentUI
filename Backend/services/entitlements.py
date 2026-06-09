"""Entitlements — the single source of truth for what a paid plan unlocks.

All feature gates (career mentor, saved chat sessions, rerun, ...) route through
``feature_allowed`` so there is exactly one place that decides Pro access. With
the current Free/Pro model an *active* subscription is Pro; ``subscription_tier``
is persisted by the Stripe billing flow for clarity and future multi-tier
support, but entitlement is driven by the active-subscription check so existing
subscribers are never accidentally locked out.
"""

from __future__ import annotations

from typing import Any, Optional

from services.auth_service import is_subscription_active

# Features that require Pro. Anything not listed here is free for everyone.
PRO_FEATURES = frozenset(
    {
        "career_chat_unlimited",  # unlimited mentor messages
        "career_chat_sessions",   # saved, multi-thread session rail
    }
)


def has_pro(user: Optional[Any]) -> bool:
    """True when the user has an active paid subscription (i.e. Pro)."""
    if user is None:
        return False
    return is_subscription_active(
        getattr(user, "subscription_status", "") or "",
        getattr(user, "subscription_expires_at", None),
    )


def feature_allowed(user: Optional[Any], feature: str) -> bool:
    """Whether ``user`` may access ``feature``.

    Free features are allowed for everyone (including anonymous callers); Pro
    features require an active subscription.
    """
    if feature not in PRO_FEATURES:
        return True
    return has_pro(user)
