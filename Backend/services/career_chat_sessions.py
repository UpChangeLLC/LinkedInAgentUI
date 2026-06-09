"""Career-chat per-user session helpers.

Pure logic kept here so the auto-title and ownership rules are unit-tested
without a DB. The route layer (``routes/career_chat.py``) maps the opaque Redis
session id to a per-user index row and enforces ``owns_session`` to close the
pre-existing IDOR on the history endpoint.
"""

from __future__ import annotations

import re
from typing import Any, Optional

_TITLE_MAX = 48
_DEFAULT_TITLE = "New chat"


def derive_title(first_user_message: str) -> str:
    """A short thread title from the first user message."""
    text = re.sub(r"\s+", " ", (first_user_message or "").strip())
    if not text:
        return _DEFAULT_TITLE
    if len(text) > _TITLE_MAX:
        return text[:_TITLE_MAX].rstrip() + "…"
    return text


def owns_session(user: Optional[Any], session_row: Optional[Any]) -> bool:
    """Whether ``user`` may access the session represented by ``session_row``.

    No row → anonymous or pre-index legacy session, allow (can't be tied to an
    account). Row present → require a matching authenticated owner.
    """
    if session_row is None:
        return True
    if user is None:
        return False
    return str(getattr(session_row, "user_signup_id", "")) == str(getattr(user, "id", ""))
