from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from ai_backend import run_pipeline_with_trace


load_dotenv()
load_dotenv("config.env", override=False)

app = FastAPI(title="MCP HTTP Adapter")

# CORS
frontend_origin = (os.getenv("FRONTEND_ORIGIN") or "").strip() or "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin] if frontend_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_api_key() -> str:
    return (os.getenv("MCP_API_KEY") or os.getenv("API_KEY") or "").strip()


def _extract_key(headers: dict) -> str:
    auth = (headers.get("authorization") or headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    xk = (headers.get("x-api-key") or headers.get("X-Api-Key") or headers.get("X-API-Key") or "").strip()
    return xk


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    # Allow CORS preflight without auth
    if request.method == "OPTIONS":
        return await call_next(request)
    # Public endpoints
    if request.url.path in {"/mcp/health"}:
        return await call_next(request)
    # SPA / static: same host as API (Docker) — do not require API key for GET assets
    if request.method == "GET" and not request.url.path.startswith("/mcp"):
        return await call_next(request)
    # Guard others
    cfg = _get_api_key()
    if cfg:
        supplied = _extract_key(request.headers)
        if not supplied or supplied != cfg:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/mcp/health")
async def mcp_health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


class MCPRunPayload(BaseModel):
    linkedin_url: str = Field(default="")
    resume_text: str = Field(default="")


class AgentTraceStep(BaseModel):
    step: str
    success: bool
    duration_ms: int
    info: str = ""


class MCPRunResponse(BaseModel):
    status: str
    data_source: str
    trace: List[AgentTraceStep]
    result: Dict[str, Any]


@app.post("/mcp/run", response_model=MCPRunResponse)
async def mcp_run(payload: MCPRunPayload) -> MCPRunResponse:
    result, trace = await run_pipeline_with_trace(
        linkedin_url=(payload.linkedin_url or "").strip(),
        resume_text=(payload.resume_text or "").strip(),
    )
    return MCPRunResponse(
        status="ok",
        data_source=result.get("data_source", "unknown"),
        trace=[AgentTraceStep(**{
            "step": str(t.get("step", "unknown")),
            "success": bool(t.get("success", False)),
            "duration_ms": int(t.get("duration_ms", 0)),
            "info": str(t.get("info", "")),
        }) for t in (trace or [])],
        result=result,
    )


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
        if full_path.startswith("mcp"):
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

