"""Health and readiness endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/mcp/health")
async def mcp_health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@router.get("/health")
async def health() -> JSONResponse:
    """Deep health check — verifies DB and Redis connectivity."""
    from db import db_available, _session_factory
    from cache import redis_available, _client as redis_client

    checks: dict = {"status": "ok"}
    status_code = 200

    # Check database
    if db_available() and _session_factory:
        try:
            from sqlalchemy import text
            async with _session_factory() as session:
                await session.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "unavailable"
            checks["status"] = "degraded"
    else:
        checks["database"] = "not_configured"

    # Check Redis
    if redis_available() and redis_client:
        try:
            await redis_client.ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "unavailable"
            checks["status"] = "degraded"
    else:
        checks["redis"] = "not_configured"

    if checks["status"] != "ok":
        status_code = 503

    return JSONResponse(checks, status_code=status_code)


@router.get("/ready")
async def ready() -> JSONResponse:
    """Readiness endpoint — checks whether the selected AI provider is configured."""
    ai_client = (os.getenv("AI_CLIENT", "openai") or "openai").strip().lower()
    key_map = {
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "groq": bool(os.getenv("GROQ_API_KEY")),
        "azure": bool(os.getenv("AZURE_OPENAI_API_KEY")) and bool(os.getenv("AZURE_OPENAI_ENDPOINT")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
    }
    configured = key_map.get(ai_client, False)
    return JSONResponse(
        {
            "status": "ok" if configured else "not_ready",
            "ai_client": ai_client,
            "ai_client_configured": configured,
        }
    )
