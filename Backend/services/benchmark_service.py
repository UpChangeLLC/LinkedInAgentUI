"""Real Peer Benchmark Engine (F15) — computes benchmarks from pipeline_runs."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Cache TTL: 24 hours
_BENCHMARK_CACHE_TTL = 86400


async def compute_benchmarks(role: str, industry: str) -> Dict[str, Any]:
    """Compute benchmark stats for a given role and industry.

    Queries pipeline_runs for matching profiles and computes aggregate
    statistics. Results are cached in Redis for 24 hours.
    """
    from cache import cache_get_json, cache_set_json, redis_available

    cache_key = f"benchmarks:{role.lower().strip()}:{industry.lower().strip()}"

    # Try Redis cache first
    if redis_available():
        cached = await cache_get_json(cache_key)
        if cached is not None:
            return cached

    # Query the database
    result = await _query_benchmarks(role, industry)

    # Cache results
    await cache_set_json(cache_key, result, ttl_seconds=_BENCHMARK_CACHE_TTL)

    return result


async def _query_benchmarks(role: str, industry: str) -> Dict[str, Any]:
    """Query pipeline_runs for matching role/industry and compute stats."""
    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        return _empty_result(role, industry)

    try:
        from sqlalchemy import select, func, text
        from db_models import PipelineRun

        async with _session_factory() as session:
            # Find pipeline_runs whose result JSONB contains matching
            # role/industry (case-insensitive partial match)
            role_filter = f"%{role.lower().strip()}%"
            industry_filter = f"%{industry.lower().strip()}%"

            # Query runs where the result contains score data and matches
            # the role/industry in the personalProfile
            base_stmt = (
                select(
                    PipelineRun.result,
                    PipelineRun.created_at,
                )
                .where(PipelineRun.result.isnot(None))
                .where(PipelineRun.error.is_(None))
                .where(
                    func.lower(
                        PipelineRun.result["personalProfile"]["title"].astext
                    ).like(role_filter)
                )
                .where(
                    func.lower(
                        PipelineRun.result["personalProfile"]["industry"].astext
                    ).like(industry_filter)
                )
                .order_by(PipelineRun.created_at.desc())
                .limit(500)
            )

            rows = (await session.execute(base_stmt)).all()

        if not rows:
            return _empty_result(role, industry)

        # Extract scores
        scores = []
        earliest = None
        latest = None
        for result_data, created_at in rows:
            if not isinstance(result_data, dict):
                continue
            score = result_data.get("score")
            if score is not None and isinstance(score, (int, float)):
                scores.append(int(score))
                if earliest is None or created_at < earliest:
                    earliest = created_at
                if latest is None or created_at > latest:
                    latest = created_at

        if not scores:
            return _empty_result(role, industry)

        scores.sort()
        count = len(scores)
        mean = round(sum(scores) / count)
        median = scores[count // 2] if count % 2 == 1 else round((scores[count // 2 - 1] + scores[count // 2]) / 2)
        p25 = scores[max(0, count // 4)]
        p75 = scores[min(count - 1, (3 * count) // 4)]

        return {
            "role": role,
            "industry": industry,
            "sample_size": count,
            "mean": mean,
            "median": median,
            "p25": p25,
            "p75": p75,
            "min": scores[0],
            "max": scores[-1],
            "date_range": {
                "earliest": earliest.isoformat() if earliest else None,
                "latest": latest.isoformat() if latest else None,
            },
        }

    except Exception:
        logger.warning("Failed to compute benchmarks", exc_info=True)
        return _empty_result(role, industry)


def _empty_result(role: str, industry: str) -> Dict[str, Any]:
    """Return empty benchmark result."""
    return {
        "role": role,
        "industry": industry,
        "sample_size": 0,
        "mean": 0,
        "median": 0,
        "p25": 0,
        "p75": 0,
        "min": 0,
        "max": 0,
        "date_range": {"earliest": None, "latest": None},
    }
