"""Consolidated FastAPI application — single entry point for all routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()
load_dotenv("config.env", override=False)

# ---------------------------------------------------------------------------
# Sentry error monitoring (no-op if SENTRY_DSN is not set)
# ---------------------------------------------------------------------------
_sentry_dsn = (os.getenv("SENTRY_DSN") or "").strip()
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        send_default_pii=False,
    )

from logging_config import setup_logging  # noqa: E402

setup_logging()

app = FastAPI(title="AI Resilience Score API")

# ---------------------------------------------------------------------------
# Middleware (order matters: last added = first executed)
# ---------------------------------------------------------------------------
from middleware import setup_cors, api_key_guard, security_headers, rate_limit  # noqa: E402

setup_cors(app)
app.middleware("http")(security_headers)
app.middleware("http")(rate_limit)
app.middleware("http")(api_key_guard)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from routes.health import router as health_router  # noqa: E402
from routes.agent import router as agent_router  # noqa: E402
from routes.stats import router as stats_router  # noqa: E402

from routes.actions import router as actions_router  # noqa: E402
from routes.teams import router as teams_router  # noqa: E402
from routes.reports import router as reports_router  # noqa: E402

app.include_router(health_router)
app.include_router(agent_router)
app.include_router(stats_router)
app.include_router(actions_router)
app.include_router(teams_router)
app.include_router(reports_router)


# ---------------------------------------------------------------------------
# Database lifecycle
# ---------------------------------------------------------------------------
from contextlib import asynccontextmanager  # noqa: E402
from db import init_db, close_db  # noqa: E402
from cache import init_redis, close_redis  # noqa: E402


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_db()
    await init_redis()
    yield
    await close_redis()
    await close_db()


app.router.lifespan_context = lifespan


# ---------------------------------------------------------------------------
# SPA static file serving (frontend dist)
# ---------------------------------------------------------------------------
def _frontend_dist() -> Path:
    raw = (os.getenv("FRONTEND_DIST") or "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parent / "dist"


def _register_spa() -> None:
    dist = _frontend_dist()
    index = dist / "index.html"
    if not dist.is_dir() or not index.is_file():
        return
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="spa_assets")

    @app.get("/")
    async def spa_root() -> FileResponse:
        return FileResponse(index)

    @app.get("/{full_path:path}")
    async def spa_catch_all(full_path: str) -> FileResponse:
        # Don't serve SPA for API routes
        if full_path.startswith(("mcp", "agent", "api")):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (dist / full_path).resolve()
        try:
            candidate.relative_to(dist.resolve())
        except ValueError:
            return FileResponse(index)
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


_register_spa()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
