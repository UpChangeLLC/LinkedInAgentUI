"""Middleware: CORS, API key guard, security headers, rate limiting."""

from __future__ import annotations

import hashlib
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


def setup_cors(app: FastAPI) -> None:
    """Configure CORS middleware based on FRONTEND_ORIGIN env var."""
    frontend_origin = (os.getenv("FRONTEND_ORIGIN") or "").strip()
    if frontend_origin:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[frontend_origin],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )


def _get_api_key() -> str:
    return (os.getenv("MCP_API_KEY") or os.getenv("API_KEY") or "").strip()


def _extract_key(headers: dict) -> str:
    auth = (headers.get("authorization") or headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    xk = (
        headers.get("x-api-key")
        or headers.get("X-Api-Key")
        or headers.get("X-API-Key")
        or ""
    ).strip()
    return xk


# Public paths that never require auth
_PUBLIC_PATHS = {"/mcp/health", "/health", "/ready", "/api/stats", "/api/events"}


async def api_key_guard(request: Request, call_next):
    """Enforce API key when MCP_API_KEY is configured."""
    if request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path or "/"
    if path in _PUBLIC_PATHS:
        return await call_next(request)
    # Allow GET for static assets (SPA)
    if request.method == "GET" and not path.startswith(("/mcp", "/agent", "/api")):
        return await call_next(request)
    cfg = _get_api_key()
    if cfg:
        supplied = _extract_key(request.headers)
        if not supplied or supplied != cfg:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMITED_PREFIXES = ("/mcp/run", "/agent/run")


def _ip_hash(request: Request) -> str:
    """SHA256 hash of client IP — never store raw IPs."""
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else "unknown")
    return hashlib.sha256(ip.encode()).hexdigest()


async def rate_limit(request: Request, call_next):
    """Sliding window rate limiter for agent endpoints. Uses Redis; no-ops if unavailable."""
    path = request.url.path or "/"
    if any(path.startswith(p) for p in _RATE_LIMITED_PREFIXES):
        from cache import rate_limit_check
        key = f"ratelimit:{_ip_hash(request)}"
        allowed = await rate_limit_check(key, _RATE_LIMIT_MAX, _RATE_LIMIT_WINDOW)
        if not allowed:
            return JSONResponse(
                {"detail": "Too many requests. Please try again in a minute."},
                status_code=429,
            )
    return await call_next(request)


async def security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'"
    )
    return response
