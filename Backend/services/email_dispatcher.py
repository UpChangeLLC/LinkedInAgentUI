"""Email queue dispatcher (Workstream D, spec 03 §6.4).

A Postgres-backed queue polled on an interval. `should_skip` (pure, tested)
encodes the per-stream unsubscribe + premium rules; the loop is opt-in via
``EMAIL_DISPATCHER_ENABLED`` so it never runs in tests/dev unless requested.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from services.auth_service import is_subscription_active
from services.email import send_email

logger = logging.getLogger(__name__)

_STREAM_PREF = {
    "welcome": "score_updates",
    "score_explainer": "score_updates",
    "decay_nudge": "reassessment_reminders",
    "premium_upsell": "product_tips",
    "transactional": None,
}

# Non-transactional streams that are pointless to send to a paying subscriber.
_PREMIUM_SUPPRESSED = {"premium_upsell", "score_explainer"}


def stream_pref_field(stream: str) -> Optional[str]:
    """Map a message stream to its NotificationPreferences boolean field."""
    return _STREAM_PREF.get(stream or "", "score_updates")


def should_skip(stream: str, user_is_premium: bool, prefs: Optional[Dict[str, Any]]) -> bool:
    """Decide whether a queued email should be skipped at send time."""
    field = stream_pref_field(stream)
    if field is None:  # transactional — always send
        return False
    if user_is_premium and stream in _PREMIUM_SUPPRESSED:
        return True
    if prefs is not None and prefs.get(field) is False:
        return True
    return False


def _enabled() -> bool:
    return os.getenv("EMAIL_DISPATCHER_ENABLED", "false").strip().lower() == "true"


async def dispatch_due(limit: int = 50) -> int:
    """Send all queued emails whose schedule has arrived. Returns count sent."""
    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        return 0

    from sqlalchemy import select
    from db_models import EmailQueue, NotificationPreferences, UserSignup

    sent = 0
    async with _session_factory() as session:
        rows = (
            await session.execute(
                select(EmailQueue)
                .where(EmailQueue.status == "queued")
                .where(EmailQueue.scheduled_for <= datetime.now(timezone.utc))
                .order_by(EmailQueue.scheduled_for)
                .limit(limit)
            )
        ).scalars().all()

        for item in rows:
            user = None
            prefs = None
            if item.user_signup_id:
                user = (
                    await session.execute(
                        select(UserSignup).where(UserSignup.id == item.user_signup_id)
                    )
                ).scalar_one_or_none()
                prefs_row = (
                    await session.execute(
                        select(NotificationPreferences).where(
                            NotificationPreferences.user_signup_id == item.user_signup_id
                        )
                    )
                ).scalar_one_or_none()
                if prefs_row is not None:
                    prefs = {
                        "score_updates": prefs_row.score_updates,
                        "reassessment_reminders": prefs_row.reassessment_reminders,
                        "product_tips": prefs_row.product_tips,
                    }

            is_premium = bool(
                user
                and is_subscription_active(user.subscription_status, user.subscription_expires_at)
            )
            if should_skip(item.message_stream or "", is_premium, prefs):
                item.status = "skipped"
                continue

            ok = await send_email(
                template=item.template,
                to=(user.email if user else "") or "",
                model=item.model or {},
                message_stream=item.message_stream or "outbound",
            )
            if ok:
                item.status = "sent"
                item.sent_at = datetime.now(timezone.utc)
                sent += 1
            else:
                item.status = "failed"
                item.error = "send returned no-op/failure"
        await session.commit()
    return sent


async def run_dispatcher_loop(interval_seconds: int = 60) -> None:
    """Background loop — only runs when EMAIL_DISPATCHER_ENABLED=true."""
    if not _enabled():
        logger.info("email dispatcher disabled (EMAIL_DISPATCHER_ENABLED!=true)")
        return
    logger.info("email dispatcher started (interval=%ss)", interval_seconds)
    while True:
        try:
            await dispatch_due()
        except Exception:
            logger.warning("email dispatch cycle failed", exc_info=True)
        await asyncio.sleep(interval_seconds)
