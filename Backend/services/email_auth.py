"""One-time tokens for email verification and password reset.

A raw URL-safe token is emailed to the user; only its SHA-256 hash is stored
(same `hash_token` used for access tokens). Verification is constant-time and
enforces expiry. Callers clear the stored hash after a successful verify so each
token is single-use.
"""

from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.auth_service import hash_token


def make_token() -> str:
    """A fresh URL-safe one-time token (the raw value to email)."""
    return secrets.token_urlsafe(32)


def token_expiry(hours: int) -> datetime:
    """A timezone-aware expiry `hours` from now."""
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def verify_token(
    token: Optional[str],
    stored_hash: Optional[str],
    expires_at: Optional[datetime],
    now: Optional[datetime] = None,
) -> bool:
    """True iff `token` hashes to `stored_hash` and `expires_at` is in the future.

    Constant-time comparison; naive `expires_at` is treated as UTC.
    """
    if not token or not stored_hash or expires_at is None:
        return False
    now = now or datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        return False
    return hmac.compare_digest(hash_token(token), stored_hash)
