"""Apify cache service — Redis → PostgreSQL → file fallback."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import structlog

from cache import cache_get_json, cache_set_json, cache_delete, redis_available
from db import db_available

logger = structlog.get_logger(__name__)

CACHE_TTL_DAYS = 7
REDIS_TTL_SECONDS = CACHE_TTL_DAYS * 86400


def _redis_key(url_hash: str) -> str:
    return f"apify:{url_hash}"


# ---------------------------------------------------------------------------
# Read path: Redis → PostgreSQL → file
# ---------------------------------------------------------------------------

async def get_cached_dataset(url_hash: str) -> Optional[Dict[str, Any]]:
    """Look up cached Apify data. Returns {"dataset_id": ..., "raw_data": ...} or None."""

    # 1. Try Redis
    if redis_available():
        hit = await cache_get_json(_redis_key(url_hash))
        if hit and isinstance(hit, dict) and hit.get("dataset_id"):
            logger.debug("apify_cache_hit", source="redis", url_hash=url_hash)
            return hit

    # 2. Try PostgreSQL
    if db_available():
        row = await _pg_get(url_hash)
        if row:
            logger.debug("apify_cache_hit", source="postgres", url_hash=url_hash)
            # Backfill Redis
            await cache_set_json(
                _redis_key(url_hash),
                {"dataset_id": row["dataset_id"], "raw_data": row.get("raw_data")},
                REDIS_TTL_SECONDS,
            )
            await _pg_record_hit(url_hash)
            return row

    # 3. Try file (legacy fallback)
    file_cache = _load_file_cache()
    dataset_id = file_cache.get(url_hash)
    if dataset_id:
        logger.debug("apify_cache_hit", source="file", url_hash=url_hash)
        return {"dataset_id": dataset_id, "raw_data": None}

    return None


# ---------------------------------------------------------------------------
# Write path: Redis + PostgreSQL + file
# ---------------------------------------------------------------------------

async def set_cached_dataset(
    url_hash: str,
    dataset_id: str,
    raw_data: Optional[Any] = None,
    linkedin_url: Optional[str] = None,
    actor_id: Optional[str] = None,
) -> None:
    """Store Apify cache entry across all available backends."""
    payload = {"dataset_id": dataset_id, "raw_data": raw_data}

    # Redis
    await cache_set_json(_redis_key(url_hash), payload, REDIS_TTL_SECONDS)

    # PostgreSQL
    if db_available():
        await _pg_upsert(url_hash, dataset_id, raw_data, linkedin_url, actor_id)

    # File (legacy)
    _save_to_file_cache(url_hash, dataset_id)

    logger.info("apify_cache_set", url_hash=url_hash, dataset_id=dataset_id)


async def invalidate_cached_dataset(url_hash: str) -> None:
    """Remove a cache entry from all backends."""
    await cache_delete(_redis_key(url_hash))
    # PostgreSQL deletion is not critical; entries expire naturally
    _remove_from_file_cache(url_hash)


# ---------------------------------------------------------------------------
# PostgreSQL helpers
# ---------------------------------------------------------------------------

async def _pg_get(url_hash: str) -> Optional[Dict[str, Any]]:
    try:
        from db import _session_factory
        if not _session_factory:
            return None
        from sqlalchemy import select, text
        from db_models import ApifyCache

        async with _session_factory() as session:
            stmt = select(ApifyCache).where(
                ApifyCache.url_hash == url_hash,
                ApifyCache.expires_at > text("now()"),
            )
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if not row:
                return None
            return {
                "dataset_id": row.dataset_id,
                "raw_data": row.raw_data,
            }
    except Exception as exc:
        logger.warning("apify_cache_pg_read_error", error=str(exc))
        return None


async def _pg_record_hit(url_hash: str) -> None:
    try:
        from db import _session_factory
        if not _session_factory:
            return
        from sqlalchemy import update
        from db_models import ApifyCache

        async with _session_factory() as session:
            stmt = (
                update(ApifyCache)
                .where(ApifyCache.url_hash == url_hash)
                .values(
                    last_hit_at=datetime.now(timezone.utc),
                    hit_count=ApifyCache.hit_count + 1,
                )
            )
            await session.execute(stmt)
            await session.commit()
    except Exception as exc:
        logger.warning("apify_cache_pg_hit_error", error=str(exc))


async def _pg_upsert(
    url_hash: str,
    dataset_id: str,
    raw_data: Optional[Any],
    linkedin_url: Optional[str],
    actor_id: Optional[str],
) -> None:
    try:
        from db import _session_factory
        if not _session_factory:
            return
        from sqlalchemy.dialects.postgresql import insert
        from db_models import ApifyCache

        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=CACHE_TTL_DAYS)
        values = {
            "url_hash": url_hash,
            "dataset_id": dataset_id,
            "raw_data": raw_data,
            "linkedin_url": linkedin_url,
            "actor_id": actor_id,
            "created_at": now,
            "expires_at": expires,
            "hit_count": 0,
        }
        async with _session_factory() as session:
            stmt = insert(ApifyCache).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["url_hash"],
                set_={
                    "dataset_id": dataset_id,
                    "raw_data": raw_data,
                    "expires_at": expires,
                },
            )
            await session.execute(stmt)
            await session.commit()
    except Exception as exc:
        logger.warning("apify_cache_pg_write_error", error=str(exc))


# ---------------------------------------------------------------------------
# File-based fallback (legacy compatibility)
# ---------------------------------------------------------------------------

def _cache_file_path() -> Path:
    return Path(os.getenv("APIFY_DATASET_CACHE_FILE", "apify_dataset_cache.json"))


def _load_file_cache() -> Dict[str, str]:
    p = _cache_file_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_to_file_cache(url_hash: str, dataset_id: str) -> None:
    try:
        cache = _load_file_cache()
        cache[url_hash] = dataset_id
        _cache_file_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception:
        pass


def _remove_from_file_cache(url_hash: str) -> None:
    try:
        cache = _load_file_cache()
        cache.pop(url_hash, None)
        _cache_file_path().write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception:
        pass
