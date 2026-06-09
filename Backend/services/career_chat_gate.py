"""Career Mentor first-message-free gate (spec 03 §5.3).

Free users get one free message; the second hits a 402. Premium users are
unlimited. Anonymous callers can't be tracked, so they're not blocked here (the
frontend already gates the mentor to premium on the free dashboard).
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException

from services.entitlements import has_pro


def _is_premium(user: Any) -> bool:
    return has_pro(user)


def enforce_career_chat_gate(user: Optional[Any]) -> None:
    """Raise 402 if a free user has already used their one free message."""
    if user is None or _is_premium(user):
        return
    if getattr(user, "career_chat_free_used", False):
        raise HTTPException(
            status_code=402,
            detail={"code": "premium_required", "feature": "career_chat_followup"},
        )


def should_mark_used(user: Optional[Any]) -> bool:
    """True when this successful message consumes the free allowance."""
    if user is None or _is_premium(user):
        return False
    return not getattr(user, "career_chat_free_used", False)
