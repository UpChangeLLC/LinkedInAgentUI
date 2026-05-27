"""Retention endpoints (Workstream D): score trajectory + re-run reminders.

Trajectory is keyed on url_hash (consistent with the existing
``GET /api/history/{url_hash}``); the frontend already holds the url_hash from
the dashboard. The transform lives in services/trajectory.py (unit-tested).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from auth_deps import require_session
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
