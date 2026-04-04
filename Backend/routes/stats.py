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

# ---------------------------------------------------------------------------
# GET /api/benchmarks — real peer benchmarks (F15)
# ---------------------------------------------------------------------------

@router.get("/api/benchmarks")
async def get_benchmarks(role: str = "", industry: str = "") -> JSONResponse:
    """Return peer benchmark statistics for a given role and industry."""
    if not role and not industry:
        return JSONResponse(
            {"status": "error", "detail": "At least one of role or industry is required."},
            status_code=400,
        )

    try:
        from services.benchmark_service import compute_benchmarks
        result = await compute_benchmarks(role=role, industry=industry)
        return JSONResponse({"status": "ok", **result})
    except Exception:
        logger.warning("Failed to compute benchmarks", exc_info=True)
        return JSONResponse(
            {"status": "error", "detail": "Failed to compute benchmarks."},
            status_code=500,
        )


# ---------------------------------------------------------------------------
# GET /api/history/{url_hash} — Assessment History Timeline (F23)
# ---------------------------------------------------------------------------

@router.get("/api/history/{url_hash}")
async def get_assessment_history(url_hash: str) -> JSONResponse:
    """Return all past assessments for a given url_hash, sorted desc."""
    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        return JSONResponse({"assessments": [], "trajectory": None})

    try:
        from sqlalchemy import select
        from db_models import AssessmentHistory

        async with _session_factory() as session:
            stmt = (
                select(
                    AssessmentHistory.score,
                    AssessmentHistory.risk_band,
                    AssessmentHistory.dimension_scores,
                    AssessmentHistory.created_at,
                )
                .where(AssessmentHistory.url_hash == url_hash)
                .order_by(AssessmentHistory.created_at.desc())
            )
            rows = (await session.execute(stmt)).all()

        assessments = [
            {
                "score": row.score,
                "risk_band": row.risk_band,
                "dimension_scores": row.dimension_scores,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]

        # Compute trajectory if 2+ data points
        trajectory = None
        if len(assessments) >= 2:
            # Use chronological order for regression
            sorted_asc = list(reversed(assessments))
            from datetime import datetime

            timestamps = []
            scores = []
            for a in sorted_asc:
                if a["created_at"]:
                    dt = datetime.fromisoformat(a["created_at"])
                    timestamps.append(dt.timestamp())
                    scores.append(a["score"])

            if len(timestamps) >= 2:
                # Simple linear regression
                n = len(timestamps)
                sum_x = sum(timestamps)
                sum_y = sum(scores)
                sum_xy = sum(t * s for t, s in zip(timestamps, scores))
                sum_xx = sum(t * t for t in timestamps)
                denom = n * sum_xx - sum_x * sum_x
                if denom != 0:
                    slope = (n * sum_xy - sum_x * sum_y) / denom
                    intercept = (sum_y - slope * sum_x) / n

                    if slope > 0 and scores[-1] < 80:
                        # Estimate when score reaches 80
                        target_timestamp = (80 - intercept) / slope
                        target_date = datetime.fromtimestamp(target_timestamp)
                        trajectory = {
                            "slope_per_day": slope * 86400,
                            "projected_low_risk_date": target_date.strftime("%B %Y"),
                            "current_trend": "improving",
                        }
                    elif slope > 0:
                        trajectory = {
                            "slope_per_day": slope * 86400,
                            "projected_low_risk_date": None,
                            "current_trend": "already_low_risk",
                        }
                    else:
                        trajectory = {
                            "slope_per_day": slope * 86400,
                            "projected_low_risk_date": None,
                            "current_trend": "declining",
                        }

        return JSONResponse({"assessments": assessments, "trajectory": trajectory})
    except Exception:
        logger.warning("Failed to query assessment history", exc_info=True)
        return JSONResponse({"assessments": [], "trajectory": None})


# ---------------------------------------------------------------------------
# GET /api/news-feed — Role-Specific AI News Feed (F27)
# ---------------------------------------------------------------------------

@router.get("/api/news-feed")
async def get_news_feed(role: str = "", industry: str = "") -> JSONResponse:
    """Return curated AI news discovery links for a given role and industry."""
    from cache import cache_get_json, cache_set_json, redis_available

    cache_key = f"news_feed:{role}:{industry}"
    if redis_available():
        cached = await cache_get_json(cache_key)
        if cached:
            return JSONResponse(cached)

    role_q = role or "executive"
    industry_q = industry or "technology"
    search_query = f"{role_q} AI {industry_q} 2026"

    import urllib.parse
    from datetime import datetime, timezone as tz

    links = [
        {
            "title": f"Latest: {role_q} & AI in {industry_q}",
            "url": f"https://news.google.com/search?q={urllib.parse.quote(search_query)}",
            "source": "Google News",
            "description": f"Latest news about AI impact on {role_q} roles in the {industry_q} sector.",
        },
        {
            "title": "AI News & Analysis",
            "url": "https://techcrunch.com/tag/artificial-intelligence/",
            "source": "TechCrunch",
            "description": "Breaking AI news, funding rounds, and product launches from TechCrunch.",
        },
        {
            "title": "AI Research & Trends",
            "url": "https://www.technologyreview.com/topic/artificial-intelligence/",
            "source": "MIT Technology Review",
            "description": "In-depth AI research, policy analysis, and emerging technology trends.",
        },
        {
            "title": "AI & the Future of Work",
            "url": "https://www.linkedin.com/news/story/ai-reshaping-the-workplace",
            "source": "LinkedIn News",
            "description": "Professional perspectives on how AI is transforming careers and industries.",
        },
        {
            "title": f"AI Tools for {role_q.title()}",
            "url": f"https://news.google.com/search?q={urllib.parse.quote(f'AI tools {role_q} productivity 2026')}",
            "source": "Google News",
            "description": f"Discover the latest AI tools and platforms designed for {role_q.title()} professionals.",
        },
    ]

    result = {"links": links, "last_updated": datetime.now(tz.utc).isoformat()}

    # Cache for 24 hours
    await cache_set_json(cache_key, result, ttl_seconds=86400)
    return JSONResponse(result)


# ---------------------------------------------------------------------------
# GET /api/community-insights — Anonymous Community Insights (F31)
# ---------------------------------------------------------------------------

@router.get("/api/community-insights")
async def get_community_insights() -> JSONResponse:
    """Return anonymized aggregate community statistics."""
    from cache import cache_get_json, cache_set_json, redis_available

    cache_key = "community:insights"
    if redis_available():
        cached = await cache_get_json(cache_key)
        if cached:
            return JSONResponse(cached)

    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        return JSONResponse({
            "total_this_month": 0,
            "most_improved_dimension": None,
            "avg_score_by_role": {},
            "top_skill_gaps": [],
        })

    try:
        from sqlalchemy import func, select, Integer as SqlInt
        from db_models import AnalyticsEvent, AssessmentHistory, PipelineRun
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        async with _session_factory() as session:
            # Total assessments this month
            count_stmt = select(func.count()).where(
                AnalyticsEvent.event_type == "assessment_completed",
                AnalyticsEvent.created_at >= month_start,
            )
            total_this_month = (await session.execute(count_stmt)).scalar() or 0

            # Average score by role category
            role_stmt = (
                select(
                    AnalyticsEvent.event_metadata["role_category"].astext.label("role"),
                    func.avg(AnalyticsEvent.event_metadata["score"].astext.cast(SqlInt)).label("avg_score"),
                )
                .where(
                    AnalyticsEvent.event_type == "assessment_completed",
                    AnalyticsEvent.event_metadata["role_category"].astext != "",
                )
                .group_by(AnalyticsEvent.event_metadata["role_category"].astext)
                .limit(10)
            )
            role_rows = (await session.execute(role_stmt)).all()
            avg_score_by_role = {row.role: round(float(row.avg_score)) for row in role_rows if row.role}

            # Most improved dimension from assessment_history deltas
            # Get users with 2+ assessments this month
            improved_stmt = (
                select(
                    AssessmentHistory.url_hash,
                    AssessmentHistory.dimension_scores,
                    AssessmentHistory.created_at,
                )
                .where(AssessmentHistory.created_at >= month_start)
                .order_by(AssessmentHistory.url_hash, AssessmentHistory.created_at)
            )
            history_rows = (await session.execute(improved_stmt)).all()

            # Compute dimension improvements
            dim_improvements: Dict[str, List[float]] = {}
            prev_by_user: Dict[str, Any] = {}
            for row in history_rows:
                uh = row.url_hash
                if uh in prev_by_user and row.dimension_scores and prev_by_user[uh]:
                    prev = prev_by_user[uh]
                    for dim, data in row.dimension_scores.items():
                        curr_score = data.get("score", 0) if isinstance(data, dict) else data
                        prev_score = prev.get(dim, {}).get("score", 0) if isinstance(prev.get(dim), dict) else prev.get(dim, 0)
                        if curr_score and prev_score:
                            dim_improvements.setdefault(dim, []).append(curr_score - prev_score)
                prev_by_user[uh] = row.dimension_scores

            most_improved = None
            if dim_improvements:
                best_dim = max(dim_improvements, key=lambda d: sum(dim_improvements[d]) / len(dim_improvements[d]))
                avg_imp = sum(dim_improvements[best_dim]) / len(dim_improvements[best_dim])
                if avg_imp > 0:
                    most_improved = {"dimension": best_dim, "avg_improvement": round(avg_imp, 1)}

            # Top skill gaps from pipeline results
            top_skill_gaps: List[str] = []
            gaps_stmt = (
                select(PipelineRun.result)
                .where(
                    PipelineRun.result.isnot(None),
                    PipelineRun.created_at >= month_start,
                )
                .order_by(PipelineRun.created_at.desc())
                .limit(50)
            )
            gap_rows = (await session.execute(gaps_stmt)).all()
            gap_counts: Dict[str, int] = {}
            for (result_data,) in gap_rows:
                if result_data and isinstance(result_data, dict):
                    gaps = result_data.get("skill_gaps", [])
                    for g in gaps[:5]:
                        name = g.get("skill", g) if isinstance(g, dict) else str(g)
                        gap_counts[name] = gap_counts.get(name, 0) + 1
            top_skill_gaps = sorted(gap_counts, key=lambda k: gap_counts[k], reverse=True)[:5]

        insights = {
            "total_this_month": total_this_month,
            "most_improved_dimension": most_improved,
            "avg_score_by_role": avg_score_by_role,
            "top_skill_gaps": top_skill_gaps,
        }

        # Cache for 1 hour
        await cache_set_json(cache_key, insights, ttl_seconds=3600)
        return JSONResponse(insights)
    except Exception:
        logger.warning("Failed to compute community insights", exc_info=True)
        return JSONResponse({
            "total_this_month": 0,
            "most_improved_dimension": None,
            "avg_score_by_role": {},
            "top_skill_gaps": [],
        })


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


# ---------------------------------------------------------------------------
# GET /api/learning-resources — matched learning resources (F17)
# ---------------------------------------------------------------------------

@router.get("/api/learning-resources")
async def get_learning_resources(skills: str = "") -> JSONResponse:
    """Return learning resources matched to the given skill names.

    Query: ?skills=machine+learning,python,data+science
    """
    if not skills.strip():
        # Return full catalog when no skills specified
        from services.learning_matcher import get_all_resources
        return JSONResponse({"status": "ok", "resources": get_all_resources()})

    skill_names = [s.strip() for s in skills.split(",") if s.strip()]
    skill_gaps = [{"name": name} for name in skill_names]

    try:
        from services.learning_matcher import match_resources
        matched = match_resources(skill_gaps, limit=20)
        return JSONResponse({"status": "ok", "resources": matched})
    except Exception:
        logger.warning("Failed to match learning resources", exc_info=True)
        return JSONResponse(
            {"status": "error", "detail": "Failed to match learning resources."},
            status_code=500,
        )
