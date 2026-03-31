"""UI-only mock server: serves dashboard and returns stored AI result JSON."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse

from exec_dashboard import AgentRunRequest, AgentRunResponse, AgentTraceStep, index

app = FastAPI(title="AI Resilience UI Test Server")


def _load_mock_result() -> Dict[str, Any]:
    """Load stored result JSON used for UI testing."""
    candidate_paths: List[Path] = []
    env_path = os.getenv("UI_TEST_RESULT_FILE", "").strip()
    if env_path:
        candidate_paths.append(Path(env_path).expanduser().resolve())
    candidate_paths.extend(
        [
            Path("Data/local_llm_output.json").resolve(),
            Path("local_llm_output.json").resolve(),
        ]
    )
    for path in candidate_paths:
        if path.exists() and path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    raise FileNotFoundError(
        "UI test result file not found. Set UI_TEST_RESULT_FILE or add Data/local_llm_output.json."
    )


def _build_mock_response() -> AgentRunResponse:
    """Build response shape expected by UI from stored result data."""
    result = _load_mock_result()
    trace = [
        AgentTraceStep(step="mock_load_result", success=True, duration_ms=12, info="loaded_from_disk"),
        AgentTraceStep(step="mock_render_ready", success=True, duration_ms=8, info="ui_test_mode"),
    ]
    return AgentRunResponse(
        status="ok",
        data_source=str(result.get("data_source", "ui_test_mock")),
        trace=trace,
        result=result,
    )


@app.get("/", response_class=HTMLResponse)
async def ui_index() -> str:
    """Serve the same dashboard HTML used in production."""
    return await index()


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "mode": "ui_test"})


@app.get("/ready")
async def ready() -> JSONResponse:
    return JSONResponse({"status": "ok", "mode": "ui_test", "mock_file_loaded": True})


@app.post("/agent/run", response_model=AgentRunResponse)
async def agent_run(_: AgentRunRequest) -> AgentRunResponse:
    """Return stored result for JSON requests."""
    try:
        return _build_mock_response()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agent/run-form", response_model=AgentRunResponse)
async def agent_run_form(
    linkedin_url: str = Form(default=""),
    resume: Optional[UploadFile] = File(default=None),
) -> AgentRunResponse:
    """Return stored result for form requests (inputs ignored in test mode)."""
    _ = linkedin_url
    _ = resume
    try:
        return _build_mock_response()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8011)
