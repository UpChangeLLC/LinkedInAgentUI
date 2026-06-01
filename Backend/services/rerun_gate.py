"""Free re-run cadence gate (30-day) keyed on the user, not the URL.

Disabled when ``RERUN_GATE_DAYS=0`` (default during rollout). Premium
subscribers always bypass. Enforced at ``/mcp/run`` — see ``enforce_rerun_gate``.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple

from fastapi import HTTPException

from services.auth_service import is_subscription_active

logger = logging.getLogger(__name__)


def _gate_days() -> int:
    try:
        return int(os.getenv("RERUN_GATE_DAYS", "0"))
    except ValueError:
        return 0


async def _latest_run_at(user_id: Any) -> Optional[datetime]:
    """Most recent successful pipeline_run timestamp for a user, or None."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return None
    try:
        from sqlalchemy import func, select

        from db_models import PipelineRun

        async with _session_factory() as session:
            stmt = (
                select(func.max(PipelineRun.created_at))
                .where(PipelineRun.user_signup_id == user_id)
                .where(PipelineRun.error.is_(None))
            )
            return (await session.execute(stmt)).scalar_one_or_none()
    except Exception:  # noqa: BLE001
        logger.warning("rerun gate lookup failed", exc_info=True)
        return None


async def can_user_rerun(user: Optional[Any]) -> Tuple[bool, Optional[datetime]]:
    """Return (allowed, next_eligible_at)."""
    days = _gate_days()
    if days <= 0 or user is None:
        return True, None
    if is_subscription_active(
        getattr(user, "subscription_status", ""),
        getattr(user, "subscription_expires_at", None),
    ):
        return True, None

    last = await _latest_run_at(user.id)
    if not last:
        return True, None
    next_at = last + timedelta(days=days)
    if datetime.now(timezone.utc) >= next_at:
        return True, None
    return False, next_at


async def enforce_rerun_gate(user: Optional[Any]) -> None:
    """Raise 429 if the user is within their free re-run cooldown."""
    allowed, next_at = await can_user_rerun(user)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RERUN_LOCKED",
                "next_rerun_at": next_at.isoformat() if next_at else None,
                "is_premium_unlock": True,
            },
        )
