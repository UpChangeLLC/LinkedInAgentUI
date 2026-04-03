"""Stats and analytics endpoints — powers LiveCounter and RecentlyAssessedTicker."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class EventPayload(BaseModel):
    event_type: str
    metadata: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# GET /api/stats — real-time metrics for frontend
# ---------------------------------------------------------------------------

async def _stats_from_db() -> Dict[str, Any]:
    """Query PostgreSQL for real stats. Returns None-safe defaults."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return {"total_assessments": 0, "recent_assessments": []}

    try:
        from sqlalchemy import func, select
        from db_models import AnalyticsEvent

        async with _session_factory() as session:
            # Total completed assessments
            count_stmt = select(func.count()).where(
                AnalyticsEvent.event_type == "assessment_completed"
            )
            total = (await session.execute(count_stmt)).scalar() or 0

            # Recent 10 assessments (anonymized)
            recent_stmt = (
                select(AnalyticsEvent.event_metadata, AnalyticsEvent.created_at)
                .where(AnalyticsEvent.event_type == "assessment_completed")
                .order_by(AnalyticsEvent.created_at.desc())
                .limit(10)
            )
            rows = (await session.execute(recent_stmt)).all()
            recent: List[Dict[str, Any]] = []
            for meta, created_at in rows:
                recent.append({
                    "role_category": (meta or {}).get("role_category", ""),
                    "score": (meta or {}).get("score"),
                    "created_at": created_at.isoformat() if created_at else None,
                })

        return {"total_assessments": total, "recent_assessments": recent}
    except Exception:
        logger.warning("Failed to query stats from DB", exc_info=True)
        return {"total_assessments": 0, "recent_assessments": []}


async def _stats_cached() -> Dict[str, Any]:
    """Try Redis cache first, fall back to DB query."""
    from cache import cache_get_json, cache_set_json, redis_available

    if redis_available():
        cached = await cache_get_json("stats:dashboard")
        if cached:
            return cached

    stats = await _stats_from_db()

    # Cache for 60 seconds
    await cache_set_json("stats:dashboard", stats, ttl_seconds=60)
    return stats


@router.get("/api/stats")
async def get_stats() -> JSONResponse:
    """Return real-time metrics for the frontend (cached 60s)."""
    stats = await _stats_cached()
    return JSONResponse(stats)


# ---------------------------------------------------------------------------
# POST /api/events — frontend analytics events
# ---------------------------------------------------------------------------

@router.post("/api/events")
async def track_event(payload: EventPayload) -> JSONResponse:
    """Record a frontend analytics event into the database."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return JSONResponse({"status": "ok"})

    try:
        from db_models import AnalyticsEvent

        event = AnalyticsEvent(
            event_type=payload.event_type,
            event_metadata=payload.metadata,
        )
        async with _session_factory() as session:
            session.add(event)
            await session.commit()
    except Exception:
        logger.warning("Failed to record analytics event", exc_info=True)

    return JSONResponse({"status": "ok"})
