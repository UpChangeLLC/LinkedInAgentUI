"""Retention endpoints (Workstream D): score trajectory + re-run reminders.

Trajectory is keyed on url_hash (consistent with the existing
``GET /api/history/{url_hash}``); the frontend already holds the url_hash from
the dashboard. The transform lives in services/trajectory.py (unit-tested).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth_deps import require_session
from services.cohort import build_cohort
from services.trajectory import build_trajectory, compute_next_rerun

logger = logging.getLogger(__name__)
router = APIRouter(tags=["retention"])


def _gate_days() -> int:
    try:
        return int(os.getenv("RERUN_GATE_DAYS", "30")) or 30
    except ValueError:
        return 30


@router.get("/api/history/{url_hash}/trajectory")
async def get_trajectory(url_hash: str) -> JSONResponse:
    """Score-progression timeline for a profile: per-run deltas + next re-run."""
    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        return JSONResponse({"history": [], "next_rerun_at": None})

    try:
        from sqlalchemy import select
        from db_models import AssessmentHistory

        async with _session_factory() as session:
            stmt = (
                select(
                    AssessmentHistory.pipeline_run_id,
                    AssessmentHistory.created_at,
                    AssessmentHistory.score,
                    AssessmentHistory.resilience_score,
                    AssessmentHistory.readiness_score,
                    AssessmentHistory.dimension_scores,
                )
                .where(AssessmentHistory.url_hash == url_hash)
                .order_by(AssessmentHistory.created_at.asc())
            )
            rows = (await session.execute(stmt)).all()

        # Prefer resilience_score; fall back to legacy `score` for v0 rows.
        mapped = [
            {
                "run_id": row.pipeline_run_id,
                "created_at": row.created_at,
                "resilience_score": row.resilience_score if row.resilience_score is not None else row.score,
                "readiness_score": row.readiness_score if row.readiness_score is not None else row.score,
                "dimension_scores": row.dimension_scores or {},
            }
            for row in rows
        ]
        history = build_trajectory(mapped)
        last_created = rows[-1].created_at if rows else None
        next_rerun = compute_next_rerun(last_created, _gate_days())
        return JSONResponse({"history": history, "next_rerun_at": next_rerun})
    except Exception:
        logger.warning("trajectory query failed", exc_info=True)
        return JSONResponse({"history": [], "next_rerun_at": None})


@router.get("/api/community-insights/cohort")
async def get_cohort(role: str = "", user_score: int = 0) -> JSONResponse:
    """Where the user stands among peers in their role (Loop 2 — social proof).

    Peer scores come from `assessment_completed` analytics events, which carry
    {score, role_category} in their metadata.
    """
    from db import db_available, _session_factory

    empty = {
        "cohort_name": role or "your role",
        "cohort_size": 0,
        "user_percentile": 0,
        "percentile_delta_30d": None,
        "distribution": [],
        "forming": True,
    }
    if not db_available() or not _session_factory:
        return JSONResponse(empty)

    try:
        from sqlalchemy import select
        from db_models import AnalyticsEvent

        async with _session_factory() as session:
            stmt = select(AnalyticsEvent.event_metadata).where(
                AnalyticsEvent.event_type == "assessment_completed"
            )
            rows = (await session.execute(stmt)).scalars().all()

        scores: list[float] = []
        for meta in rows:
            if not isinstance(meta, dict):
                continue
            if role and str(meta.get("role_category", "")).lower() != role.lower():
                continue
            score = meta.get("score")
            if isinstance(score, (int, float)):
                scores.append(float(score))

        cohort = build_cohort(scores, float(user_score))
        cohort["cohort_name"] = role or "your role"
        cohort["percentile_delta_30d"] = None  # longitudinal delta deferred
        return JSONResponse(cohort)
    except Exception:
        logger.warning("cohort query failed", exc_info=True)
        return JSONResponse(empty)


class NotificationPrefsBody(BaseModel):
    score_updates: bool | None = None
    reassessment_reminders: bool | None = None
    product_tips: bool | None = None


_DEFAULT_PREFS = {"score_updates": True, "reassessment_reminders": True, "product_tips": True}


@router.get("/api/notifications/preferences")
async def get_notification_preferences(user=Depends(require_session)) -> JSONResponse:
    """Per-stream email opt-ins (defaults to all-on)."""
    from db import db_available, _session_factory

    if user is None or not db_available() or not _session_factory:
        return JSONResponse(dict(_DEFAULT_PREFS))
    try:
        from sqlalchemy import select
        from db_models import NotificationPreferences

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(NotificationPreferences).where(
                        NotificationPreferences.user_signup_id == user.id
                    )
                )
            ).scalar_one_or_none()
        if not row:
            return JSONResponse(dict(_DEFAULT_PREFS))
        return JSONResponse(
            {
                "score_updates": row.score_updates,
                "reassessment_reminders": row.reassessment_reminders,
                "product_tips": row.product_tips,
            }
        )
    except Exception:
        logger.warning("get preferences failed", exc_info=True)
        return JSONResponse(dict(_DEFAULT_PREFS))


@router.patch("/api/notifications/preferences")
async def update_notification_preferences(
    body: NotificationPrefsBody, user=Depends(require_session)
) -> JSONResponse:
    """Upsert the user's notification preferences."""
    from db import db_available, _session_factory

    if user is None or not db_available() or not _session_factory:
        return JSONResponse({"status": "ok", "persisted": False})
    try:
        from sqlalchemy import select
        from db_models import NotificationPreferences

        patch = {k: v for k, v in body.model_dump().items() if v is not None}
        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(NotificationPreferences).where(
                        NotificationPreferences.user_signup_id == user.id
                    )
                )
            ).scalar_one_or_none()
            if row is None:
                row = NotificationPreferences(user_signup_id=user.id, **{**_DEFAULT_PREFS, **patch})
                session.add(row)
            else:
                for k, v in patch.items():
                    setattr(row, k, v)
                row.updated_at = datetime.now(timezone.utc)
            await session.commit()
        return JSONResponse({"status": "ok", "persisted": True})
    except Exception:
        logger.warning("update preferences failed", exc_info=True)
        return JSONResponse({"status": "error"}, status_code=500)


@router.post("/api/email/webhook")
async def email_webhook(request: Request) -> JSONResponse:
    """Postmark-style open/click webhook -> analytics events (fire-and-forget)."""
    from db import db_available, _session_factory

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    record_type = str(payload.get("RecordType", "")).lower()  # 'open' | 'click'
    if not db_available() or not _session_factory or record_type not in ("open", "click"):
        return JSONResponse({"status": "ok"})
    try:
        from db_models import AnalyticsEvent

        async with _session_factory() as session:
            session.add(
                AnalyticsEvent(
                    event_type=f"email_{record_type}ed",
                    event_metadata={
                        "template": payload.get("Tag") or payload.get("MessageStream"),
                        "message_id": payload.get("MessageID"),
                    },
                )
            )
            await session.commit()
    except Exception:
        logger.warning("email webhook record failed", exc_info=True)
    return JSONResponse({"status": "ok"})


@router.post("/api/notifications/set-rerun-reminder")
async def set_rerun_reminder(user=Depends(require_session)) -> JSONResponse:
    """Queue a one-shot email when the user's next free re-run unlocks."""
    from db import db_available, _session_factory

    if user is None or not db_available() or not _session_factory:
        return JSONResponse({"status": "ok", "scheduled": False})

    try:
        from sqlalchemy import func, select
        from db_models import EmailQueue, PipelineRun

        async with _session_factory() as session:
            last = (
                await session.execute(
                    select(func.max(PipelineRun.created_at)).where(
                        PipelineRun.user_signup_id == user.id
                    )
                )
            ).scalar_one_or_none()
            next_at_iso = compute_next_rerun(last, _gate_days()) if last else None
            scheduled_for = (
                datetime.fromisoformat(next_at_iso) if next_at_iso else datetime.now(timezone.utc)
            )
            session.add(
                EmailQueue(
                    user_signup_id=user.id,
                    template="rerun_available",
                    message_stream="decay_nudge",
                    scheduled_for=scheduled_for,
                    status="queued",
                )
            )
            await session.commit()
        return JSONResponse({"status": "ok", "scheduled": True, "scheduled_for": next_at_iso})
    except Exception:
        logger.warning("set_rerun_reminder failed", exc_info=True)
        return JSONResponse({"status": "ok", "scheduled": False})
