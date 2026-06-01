"""Lifecycle email enqueue logic (Workstream D, spec 03 §6.2).

`plan_assessment_emails` is pure (tested): given whether this is a user's first
assessment and whether they're premium, it returns which lifecycle emails to
schedule and at what offset. `enqueue_assessment_emails` applies the plan to the
email_queue, first clearing stale pending decay nudges so only the latest run's
nudges remain queued.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_DECAY = [
    {"template": "decay_nudge_21d", "message_stream": "decay_nudge", "offset_days": 21},
    {"template": "decay_nudge_30d", "message_stream": "decay_nudge", "offset_days": 30},
    {"template": "decay_nudge_45d", "message_stream": "decay_nudge", "offset_days": 45},
]


def plan_assessment_emails(is_first: bool, is_premium: bool) -> List[Dict[str, Any]]:
    """Return the lifecycle emails to schedule after an assessment completes."""
    plan: List[Dict[str, Any]] = []
    if is_first:
        plan.append({"template": "welcome", "message_stream": "welcome", "offset_days": 0})
    if is_premium:
        return plan  # premium: no drip, no decay nudges
    if is_first:
        plan.append({"template": "score_explainer", "message_stream": "score_explainer", "offset_days": 3})
    plan.extend(_DECAY)
    return plan


def build_assessment_model(result: Dict[str, Any], full_name: str = "") -> Dict[str, Any]:
    """Template model fields shared across lifecycle emails."""
    first_name = (full_name or "").strip().split(" ")[0] if full_name else ""
    return {
        "first_name": first_name,
        "resilience_score": result.get("resilience_score") or result.get("profile_score"),
        "readiness_score": result.get("readiness_score"),
    }


async def enqueue_assessment_emails(user_signup_id, result: Dict[str, Any]) -> None:
    """Schedule lifecycle emails for a user after a successful assessment.

    Fire-and-forget; never raises. Clears stale pending decay nudges first.
    """
    from db import db_available, _session_factory

    if user_signup_id is None or not db_available() or not _session_factory:
        return
    try:
        from sqlalchemy import delete, func, select
        from db_models import EmailQueue, PipelineRun, UserSignup
        from services.auth_service import is_subscription_active

        now = datetime.now(timezone.utc)
        async with _session_factory() as session:
            user = (
                await session.execute(select(UserSignup).where(UserSignup.id == user_signup_id))
            ).scalar_one_or_none()
            if user is None:
                return
            is_premium = is_subscription_active(user.subscription_status, user.subscription_expires_at)

            run_count = (
                await session.execute(
                    select(func.count(PipelineRun.id)).where(
                        PipelineRun.user_signup_id == user_signup_id
                    )
                )
            ).scalar_one()
            is_first = (run_count or 0) <= 1

            plan = plan_assessment_emails(is_first=is_first, is_premium=is_premium)
            if not plan:
                return

            # Cancel any still-pending decay nudges from earlier runs.
            await session.execute(
                delete(EmailQueue).where(
                    EmailQueue.user_signup_id == user_signup_id,
                    EmailQueue.message_stream == "decay_nudge",
                    EmailQueue.status == "queued",
                )
            )

            model = build_assessment_model(result, user.full_name or "")
            for item in plan:
                session.add(
                    EmailQueue(
                        user_signup_id=user_signup_id,
                        template=item["template"],
                        message_stream=item["message_stream"],
                        model=model,
                        scheduled_for=now + timedelta(days=item["offset_days"]),
                        status="queued",
                    )
                )
            await session.commit()
    except Exception:
        logger.warning("failed to enqueue lifecycle emails", exc_info=True)
