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
    return JSONResponse({"status": "ok"})


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
