"""Redis client factory and cache helpers."""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import redis.asyncio as redis

_client: Optional[redis.Redis] = None


def get_redis_url() -> str:
    return (os.getenv("REDIS_URL") or "").strip()


async def init_redis() -> None:
    """Initialize Redis connection. No-op if REDIS_URL is not set."""
    global _client
    url = get_redis_url()
    if not url:
        return
    _client = redis.from_url(url, decode_responses=True)
    try:
        await _client.ping()
    except Exception:
        _client = None


async def close_redis() -> None:
    global _client
    if _client:
        await _client.aclose()
    _client = None


def redis_available() -> bool:
    return _client is not None


async def cache_get(key: str) -> Optional[str]:
    """Get a string value from Redis. Returns None if unavailable or missing."""
    if not _client:
        return None
    try:
        return await _client.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl_seconds: int = 3600) -> bool:
    """Set a string value in Redis with TTL. Returns False if unavailable."""
    if not _client:
        return False
    try:
        await _client.set(key, value, ex=ttl_seconds)
        return True
    except Exception:
        return False


async def cache_delete(key: str) -> bool:
    """Delete a key from Redis."""
    if not _client:
        return False
    try:
        await _client.delete(key)
        return True
    except Exception:
        return False


async def cache_get_json(key: str) -> Optional[Any]:
    """Get and parse a JSON value from Redis."""
    raw = await cache_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """Serialize a value to JSON and store in Redis."""
    try:
        return await cache_set(key, json.dumps(value), ttl_seconds)
    except (TypeError, ValueError):
        return False


async def rate_limit_check(key: str, max_requests: int, window_seconds: int) -> bool:
    """Sliding window rate limiter. Returns True if request is ALLOWED."""
    if not _client:
        return True  # Allow all if Redis unavailable
    import time
    try:
        now = time.time()
        pipe = _client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
        current_count = results[2]
        return current_count <= max_requests
    except Exception:
        return True  # Fail open
