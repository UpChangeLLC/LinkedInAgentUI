"""Career Mentor free-message gate.

Free users get FREE_CHAT_MESSAGE_LIMIT messages (env, default 5); the next one
hits a 402. Premium users are unlimited. Anonymous callers can't be tracked, so
they're not blocked here (the frontend gates the mentor on the free dashboard).
"""

from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import HTTPException

from services.entitlements import has_pro

DEFAULT_FREE_CHAT_MESSAGE_LIMIT = 5


def free_chat_message_limit() -> int:
    """Number of free Career Mentor messages, from FREE_CHAT_MESSAGE_LIMIT."""
    raw = os.getenv("FREE_CHAT_MESSAGE_LIMIT")
    if raw is None:
        return DEFAULT_FREE_CHAT_MESSAGE_LIMIT
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_FREE_CHAT_MESSAGE_LIMIT
    return value if value >= 0 else DEFAULT_FREE_CHAT_MESSAGE_LIMIT


def _is_premium(user: Any) -> bool:
    return has_pro(user)


def _messages_used(user: Any) -> int:
    try:
        return int(getattr(user, "career_chat_messages_used", 0) or 0)
    except (TypeError, ValueError):
        return 0


def enforce_career_chat_gate(user: Optional[Any]) -> None:
    """Raise 402 once a free user has used their FREE_CHAT_MESSAGE_LIMIT messages."""
    if user is None or _is_premium(user):
        return
    if _messages_used(user) >= free_chat_message_limit():
        raise HTTPException(
            status_code=402,
            detail={"code": "premium_required", "feature": "career_chat_followup"},
        )


def should_mark_used(user: Optional[Any]) -> bool:
    """True when this successful message should increment the free counter."""
    if user is None or _is_premium(user):
        return False
    return True
