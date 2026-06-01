"""Consolidated authentication primitives.

Single home for the token/password/subscription helpers that were previously
duplicated across ``routes/signup.py`` and ``routes/payments.py``. The session
dependency (``auth_deps.py``) and the mid-onboarding signup endpoint both build
on these so there is exactly one implementation of each.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

_PASSWORD_ITERATIONS = 310_000


def hash_token(token: str) -> str:
    """SHA-256 of an access token (stored as ``access_token_hash``)."""
    return hashlib.sha256(token.strip().encode()).hexdigest()


def new_access_token() -> str:
    """Generate a fresh URL-safe opaque access token."""
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 password hash with a random salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PASSWORD_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    """Constant-time verification of a password against a stored PBKDF2 hash."""
    if not stored_hash:
        return False
    try:
        scheme, iterations_raw, salt, expected = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def is_subscription_active(status: str, expires_at: Optional[datetime]) -> bool:
    """True only when status is 'active' and the expiry is in the future."""
    if status != "active" or not expires_at:
        return False
    return expires_at > datetime.now(timezone.utc)
