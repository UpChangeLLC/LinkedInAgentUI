"""FastAPI session dependencies for the per-user hard auth gate.

Per-user identity rides the ``X-Session-Token`` header. The static
``Authorization: Bearer <MCP_API_KEY>`` header is a separate, orthogonal
app-level gate (``middleware.api_key_guard``) and must NOT be overloaded.

The gate is flag-gated by ``ALLOW_ANON_RUN`` (default ``true``) so it can be
deployed dark and flipped to ``false`` at cutover (master plan §sequencing).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

SESSION_HEADER = "X-Session-Token"


def _anon_allowed() -> bool:
    return os.getenv("ALLOW_ANON_RUN", "true").strip().lower() == "true"


async def _lookup_user_by_token(token: str) -> Optional[Any]:
    """Resolve a UserSignup by its access token, or None.

    Returns None (never raises) when the DB is unavailable so the dependency
    degrades gracefully — the gate decision is made by the caller.
    """
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return None
    try:
        from sqlalchemy import select

        from db_models import UserSignup
        from services.auth_service import hash_token

        async with _session_factory() as session:
            stmt = select(UserSignup).where(
                UserSignup.access_token_hash == hash_token(token)
            )
            return (await session.execute(stmt)).scalar_one_or_none()
    except Exception:  # noqa: BLE001
        logger.warning("session token lookup failed", exc_info=True)
        return None


async def _resolve(request: Request) -> Optional[Any]:
    token = (request.headers.get(SESSION_HEADER) or "").strip()
    if not token:
        return None
    return await _lookup_user_by_token(token)


async def require_session(request: Request) -> Optional[Any]:
    """Resolve the session user; enforce the hard gate when anon is disallowed.

    * valid token        -> the UserSignup
    * no/invalid token, anon allowed   -> None (soft pass)
    * no/invalid token, anon disallowed -> 401
    """
    user = await _resolve(request)
    if user is not None:
        return user
    if _anon_allowed():
        return None
    raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED"})


async def optional_session(request: Request) -> Optional[Any]:
    """Resolve the session user if present; never raises."""
    return await _resolve(request)
