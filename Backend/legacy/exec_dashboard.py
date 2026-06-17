"""Executive dashboard version for career resilience analysis."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from ai_backend import (
    extract_text_from_resume,
    run_pipeline_with_trace,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
load_dotenv()
load_dotenv("config.env", override=False)

app = FastAPI(title="AI Resilience Exec Dashboard")

# ── CORS & API key protection ───────────────────────────────────────────────────
frontend_origin = (os.getenv("FRONTEND_ORIGIN") or "").strip() or "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin] if frontend_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_configured_api_key() -> str:
    # Prefer MCP_API_KEY; fallback to API_KEY if provided
    return (os.getenv("MCP_API_KEY") or os.getenv("API_KEY") or "").strip()


def _extract_api_key_from_request_headers(headers: dict) -> str:
    auth = (headers.get("authorization") or headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    x_key = (headers.get("x-api-key") or headers.get("X-Api-Key") or headers.get("X-API-Key") or "").strip()
    return x_key


@app.middleware("http")
async def api_key_guard(request, call_next):
    # Allow health, readiness, and root page without auth
    path = request.url.path or "/"
    if path in {"/", "/health", "/ready"}:
        return await call_next(request)
    # Enforce API key only if configured
    configured = _get_configured_api_key()
    if configured:
        supplied = _extract_api_key_from_request_headers(request.headers)
        if not supplied or supplied != configured:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


class AgentRunRequest(BaseModel):
    """Input payload for JSON agent execution."""

    linkedin_url: str = Field(default="")
    resume_text: str = Field(default="")


class AgentTraceStep(BaseModel):
    """Single execution step telemetry."""

    step: str
    success: bool
    duration_ms: int
    info: str = ""


class AgentRunResponse(BaseModel):
    """Agent response with trace."""

    status: str
    data_source: str
    trace: List[AgentTraceStep]
    result: Dict[str, Any]


def _normalize_error_message(error_text: str) -> str:
    """Convert backend exception text into user-friendly UI message."""
    msg = (error_text or "").strip()
    lower = msg.lower()
    if "at least one of linkedin_url or resume_text" in lower:
        return "Please provide at least one input: LinkedIn URL or resume file."
    if "invalid linkedin url" in lower:
        return "LinkedIn URL looks invalid. Please use a profile URL like linkedin.com/in/username."
    if "apify_api_token is not set" in lower:
        return "LinkedIn fetch is not configured. Set APIFY_API_TOKEN in config.env."
    if "openai_api_key is not set" in lower:
        return "OPENAI_API_KEY is missing. Update config.env and try again."
    if "groq_api_key is not set" in lower:
        return "GROQ_API_KEY is missing. Update config.env and try again."
    if "anthropic_api_key is not set" in lower:
        return "ANTHROPIC_API_KEY is missing. Update config.env and try again."
    if "azure_openai_api_key is not set" in lower or "azure_openai_endpoint is not set" in lower:
        return "Azure OpenAI settings are incomplete. Check AZURE_OPENAI_* values in config.env."
    if "pipeline completed without result" in lower:
        return "The analysis pipeline finished without usable output. Please retry."
    return msg or "Something went wrong while processing your request."


async def _run_agent(linkedin_url: str, resume_text: str) -> AgentRunResponse:
    """Run full agent flow with step-level trace output."""
    linkedin = linkedin_url.strip()
    resume = resume_text.strip()

    if not linkedin and not resume:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one input: LinkedIn URL or resume.",
        )

    start = time.perf_counter()
    try:
        result, node_trace = await run_pipeline_with_trace(linkedin_url=linkedin, resume_text=resume)
        trace: List[AgentTraceStep] = [
            AgentTraceStep(
                step=str(item.get("step", "unknown")),
                success=bool(item.get("success", False)),
                duration_ms=int(item.get("duration_ms", 0)),
                info=str(item.get("info", "")),
            )
            for item in node_trace
        ]
        trace.append(
            AgentTraceStep(
                step="total_pipeline",
                success=True,
                duration_ms=int((time.perf_counter() - start) * 1000),
                info=f"source={result.get('data_source', 'unknown')}",
            )
        )
        data_source = result.get("data_source", "unknown")
        return AgentRunResponse(
            status="ok",
            data_source=data_source,
            trace=trace,
            result=result,
        )
    except Exception as exc:
        logger.exception("Agent pipeline failed")
        friendly = _normalize_error_message(str(exc))
        raise HTTPException(
            status_code=400,
            detail={
                "message": friendly,
                "raw_error": str(exc),
                "retryable": True,
            },
        ) from exc


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    """Serve executive dashboard page."""
    return """
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>AI Resilience Score Dashboard</title>
  <style>
    :root {
      --bg: #f5f8ff;
      --bg-soft: #f9fbff;
      --panel: #ffffff;
      --text: #16233f;
      --muted: #64769a;
      --good: #17b26a;
      --warn: #f79009;
      --bad: #f04438;
      --brand: #5163f5;
      --brand-soft: #7c8dff;
      --line: #dde5f5;
      --shadow-sm: 0 8px 24px rgba(29, 54, 111, 0.08);
      --shadow-md: 0 14px 34px rgba(29, 54, 111, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      background:
        radial-gradient(1200px 480px at 20% -10%, #dfe8ff 0%, transparent 50%),
        radial-gradient(900px 360px at 90% 0%, #eaf0ff 0%, transparent 50%),
        linear-gradient(180deg, #fafdff 0%, var(--bg) 45%, #f3f7ff 100%);
      color: var(--text);
    }
    .layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .sidebar {
      border-right: 1px solid var(--line);
      background: linear-gradient(180deg, #f7f9ff, #eef3ff);
      padding: 20px 14px;
      position: sticky;
      top: 0;
      height: 100vh;
      backdrop-filter: blur(8px);
    }
    .brand {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 18px;
      letter-spacing: .01em;
      color: #1d2f57;
    }
    .nav { display: grid; gap: 10px; }
    .nav a {
      color: var(--muted);
      text-decoration: none;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      font-weight: 600;
    }
    .nav a:hover {
      border-color: #d3ddf2;
      background: #ffffff;
      color: var(--text);
      box-shadow: var(--shadow-sm);
    }
    .container { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .title {
      font-size: 50px;
      line-height: 1.08;
      font-weight: 900;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
      background: linear-gradient(90deg, #142b56 0%, #24498d 55%, #3f57e8 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      text-wrap: balance;
    }
    .subtitle { margin: 0 0 20px 0; color: var(--muted); }
    .grid { display: grid; gap: 16px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .panel {
      background: linear-gradient(180deg, #ffffff, #f9fbff);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
      box-shadow: var(--shadow-sm);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease;
    }
    .panel:hover {
      transform: translateY(-1px);
      border-color: #ccd8ef;
      box-shadow: var(--shadow-md);
      background: linear-gradient(180deg, #ffffff, #f7faff);
    }
    .label { font-size: 12px; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
    .label[data-icon]::before {
      content: attr(data-icon);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      border-radius: 7px;
      background: #edf2ff;
      border: 1px solid #d5def5;
      font-size: 11px;
      vertical-align: middle;
    }
    input, button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--text);
      padding: 12px;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: #9db1f7;
      box-shadow: 0 0 0 4px rgba(81, 99, 245, 0.12);
    }
    button {
      margin-top: 10px;
      background: linear-gradient(90deg, var(--brand), var(--brand-soft));
      border: none;
      color: #ffffff;
      cursor: pointer;
      font-weight: 700;
      box-shadow: 0 10px 22px rgba(81, 99, 245, 0.28);
    }
    button:hover { filter: brightness(1.04); }
    .metric { font-size: 32px; font-weight: 700; letter-spacing: .01em; }
    .metric-sub { font-size: 12px; color: var(--muted); margin-top: 6px; }
    .small { color: var(--muted); font-size: 13px; }
    .bar {
      width: 100%;
      height: 10px;
      background: #f2f5fb;
      border: 1px solid var(--line);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 8px;
    }
    .fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #a78bfa); }
    .fill-good { background: linear-gradient(90deg, #34d399, #10b981); }
    .fill-warn { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .fill-bad { background: linear-gradient(90deg, #fb7185, #ef4444); }
    ul { margin: 8px 0 0 18px; color: var(--muted); }
    .ok { color: var(--good); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .summary { line-height: 1.5; color: #1f2c4d; }
    .hidden { display: none; }
    [hidden] { display: none !important; }
    .fade-in { animation: fadeInUp 280ms ease-out; }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #eff4ff;
      border: 1px solid #d6e1fb;
      color: #324a7d;
      font-size: 12px;
      margin-top: 8px;
      font-weight: 600;
    }
    .status-loading::before {
      content: "";
      display: inline-block;
      width: 11px;
      height: 11px;
      margin-right: 8px;
      border: 2px solid #7f8abb;
      border-top-color: #d6dcff;
      border-radius: 50%;
      vertical-align: -1px;
      animation: spin .8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .list-soft li { margin-bottom: 8px; line-height: 1.4; }
    .risk-pill {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .risk-pill-ok { background: rgba(16, 185, 129, .14); color: #86efac; border-color: rgba(16, 185, 129, .3); }
    .risk-pill-warn { background: rgba(245, 158, 11, .14); color: #fcd34d; border-color: rgba(245, 158, 11, .3); }
    .risk-pill-bad { background: rgba(239, 68, 68, .14); color: #fda4af; border-color: rgba(239, 68, 68, .3); }
    .rec-grid {
      display: grid;
      gap: 10px;
      margin-top: 8px;
    }
    .rec-card {
      border: 1px solid #e0e6f3;
      background: #fafbfe;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .rec-priority {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #7381a1;
      margin-bottom: 6px;
    }
    .rec-action {
      color: #1f2c4d;
      font-weight: 600;
      line-height: 1.4;
    }
    .rec-reason {
      color: #7483a3;
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.4;
    }
    .meter-wrap { margin-top: 10px; }
    .meter-track {
      width: 100%;
      height: 12px;
      border-radius: 999px;
      background: #edf3ff;
      border: 1px solid #d4e0ff;
      overflow: hidden;
    }
    .meter-fill {
      height: 100%;
      width: 0%;
      transition: width 260ms ease, background 220ms ease;
      background: linear-gradient(90deg, #fbbf24, #f59e0b);
    }
    .meter-legend {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 11px;
      color: var(--muted);
    }
    .exp-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 6px;
    }
    .exp-pill {
      border: 1px solid #d9e3ff;
      background: #f7faff;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .exp-value {
      font-size: 22px;
      font-weight: 700;
      color: #22325a;
      line-height: 1.1;
    }
    .exp-label {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    pre { white-space: pre-wrap; color: #cdd5f4; }
    .trend-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 8px; }
    .trend-bar {
      background: linear-gradient(180deg, #7c3aed, #60a5fa);
      border-radius: 6px 6px 2px 2px;
      min-height: 8px;
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
    }
    .btn-secondary {
      width: auto;
      padding: 10px 14px;
      background: #eef2fb;
      border: 1px solid var(--line);
      color: var(--text);
      border-radius: 12px;
      cursor: pointer;
      font-weight: 700;
    }
    .mode-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
      border: 1px solid var(--line);
      background: #f5f7fc;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .mode-wrap input {
      width: auto;
      margin: 0;
      accent-color: #8b7bff;
    }
    .compact-hidden { display: none !important; }
    .flow-section {
      opacity: 1;
      transform: translateY(0);
      transition: opacity 260ms ease, transform 260ms ease;
    }
    .flow-hidden {
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
    }
    .wait-track {
      margin-top: 10px;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: #f1f4fb;
      border: 1px solid #dde4f3;
      overflow: hidden;
      display: none;
    }
    .wait-track.active { display: block; }
    .wait-fill {
      width: 35%;
      height: 100%;
      background: linear-gradient(90deg, #7c83ff, #9f8bff);
      animation: waitSlide 1.15s ease-in-out infinite;
    }
    @keyframes waitSlide {
      0% { transform: translateX(-130%); }
      100% { transform: translateX(360%); }
    }
    .panel-stagger {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }
    .panel-stagger.in {
      animation: panelIn 420ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      animation-delay: var(--stagger-delay, 0ms);
    }
    @keyframes panelIn {
      from { opacity: 0; transform: translateY(10px) scale(0.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .title { font-size: 36px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">Exec AI Score</div>
      <nav class="nav">
        <a href="#input">Input</a>
        <a href="#kpi">KPI</a>
        <a href="#snapshot">Snapshot</a>
        <a href="#risk">Risk</a>
        <a href="#insights">Insights</a>
      </nav>
    </aside>
    <main class="container">
      <h1 class="title">AI Resilience Score - Exec Dashboard</h1>
      <p class="subtitle">Upload resume, add LinkedIn, and generate executive-ready resilience analysis.</p>
      <div id="source_chip" class="chip hidden"></div>

      <div class="toolbar">
        <label class="mode-wrap" for="executive_mode">
          <input id="executive_mode" type="checkbox" checked />
          Executive mode
        </label>
        <button class="btn-secondary" id="exportBtn" type="button">Export PDF</button>
      </div>

      <div class="panel" id="input">
        <form id="analyzeForm" novalidate>
          <div class="grid grid-2">
            <div>
              <div class="label">LinkedIn URL (optional)</div>
              <input type="url" id="linkedin_url" name="linkedin_url" placeholder="https://linkedin.com/in/username"/>
            </div>
            <div>
              <div class="label">Resume (PDF/DOCX/TXT, optional)</div>
              <input type="file" id="resume" name="resume" accept=".pdf,.docx,.txt"/>
            </div>
          </div>
          <button id="submitBtn" type="submit">Generate Score</button>
        </form>
        <div id="status" class="small" style="margin-top:10px;"></div>
        <div id="wait_track" class="wait-track"><div class="wait-fill"></div></div>
      </div>

      <div id="results" class="grid hidden" hidden style="margin-top:16px;">
        <div class="grid grid-3 flow-section" id="kpi">
          <div class="panel">
            <div class="label" data-icon="★">Profile Score</div>
            <div id="profile_score" class="metric">-</div>
            <div class="small">Overall profile quality</div>
            <div class="meter-wrap">
              <div class="meter-track"><div id="profile_meter" class="meter-fill"></div></div>
              <div class="meter-legend"><span>Low</span><span>High</span></div>
            </div>
          </div>
          <div class="panel">
            <div class="label" data-icon="AI">AI Replaceability Score</div>
            <div id="risk_score" class="metric">-</div>
            <div id="risk_level" class="small">-</div>
            <div class="metric-sub">Higher score means easier replacement by AI</div>
            <div id="risk_level_pill" class="risk-pill hidden"></div>
            <div class="meter-wrap">
              <div class="meter-track"><div id="risk_meter" class="meter-fill"></div></div>
              <div class="meter-legend"><span>Low replaceability</span><span>High replaceability</span></div>
            </div>
          </div>
          <div class="panel">
            <div class="label" data-icon="EX">Experience</div>
            <div class="exp-grid">
              <div class="exp-pill">
                <div id="exp_years" class="exp-value">-</div>
                <div class="exp-label">Years</div>
              </div>
              <div class="exp-pill">
                <div id="exp_roles" class="exp-value">-</div>
                <div class="exp-label">Roles held</div>
              </div>
            </div>
            <div class="small" style="margin-top:10px;">Depth by tenure</div>
            <div class="bar"><div id="exp_years_bar" class="fill" style="width:0%"></div></div>
            <div class="small" style="margin-top:8px;">Breadth by role variety</div>
            <div class="bar"><div id="exp_roles_bar" class="fill" style="width:0%"></div></div>
            <div id="exp_note" class="small" style="margin-top:8px;">-</div>
          </div>
        </div>
        
        <div class="panel flow-section" id="snapshot">
        <div class="label" data-icon="CP">Candidate Snapshot</div>
        <div id="headline" style="font-size:20px;font-weight:700;"></div>
        <div id="location" class="small" style="margin-top:4px;"></div>
        <p id="summary" class="summary"></p>
        </div>

        <div class="grid grid-2 flow-section" id="risk">
          <div class="panel">
          <div class="label" data-icon="SB">Score Breakdown</div>
          <div id="breakdown"></div>
          <div class="small" style="margin-top:12px;">Profile Completeness</div>
          <div class="bar"><div id="coverage_bar" class="fill" style="width:0%"></div></div>
          <div id="coverage_text" class="small" style="margin-top:6px;">-</div>
          </div>
          <div class="panel">
          <div class="label" data-icon="RV">AI Risk View</div>
          <p id="risk_summary" class="summary"></p>
          <div class="small">Recommendation</div>
          <p id="recommendation" class="summary"></p>
            <div class="small">Risk Skill Split</div>
            <div class="bar"><div id="risk_split_bar" class="fill" style="width:50%"></div></div>
          </div>
        </div>

        <div class="grid grid-3 flow-section" id="insights">
          <div class="panel"><div class="label" data-icon="ST">Strengths</div><ul id="strengths" class="list-soft"></ul></div>
          <div class="panel"><div class="label" data-icon="GP">Gaps</div><ul id="gaps" class="list-soft"></ul></div>
          <div class="panel"><div class="label" data-icon="SK">Top Skills</div><ul id="skills" class="list-soft"></ul></div>
        </div>

        <div id="grid_risk_timeline" class="grid grid-2 flow-section" style="margin-top:16px;">
          <div class="panel"><div class="label" data-icon="RD">Risk Drivers</div><ul id="risk_drivers" class="list-soft"></ul></div>
          <div class="panel"><div class="label" data-icon="TL">30 / 60 / 90 Plan</div><div id="timeline_plan" class="small"></div></div>
        </div>

        <div id="grid_reco_jobs" class="grid grid-2 flow-section" style="margin-top:16px;">
          <div class="panel"><div class="label" data-icon="PR">Priority Recommendations</div><div id="recommendations_cards" class="rec-grid"></div></div>
          <div class="panel"><div class="label" data-icon="JR">Job Recommendations</div><ul id="job_recommendations" class="list-soft"></ul></div>
        </div>

        <div id="grid_upskill_raw" class="grid grid-2 flow-section" style="margin-top:16px;">
          <div class="panel"><div class="label" data-icon="UP">Upskilling Plan</div><ul id="upskilling_plan" class="list-soft"></ul></div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const form = document.getElementById("analyzeForm");
    const statusEl = document.getElementById("status");
    const sourceChip = document.getElementById("source_chip");
    const results = document.getElementById("results");
    const submitBtn = document.getElementById("submitBtn");
    const exportBtn = document.getElementById("exportBtn");
    const executiveModeToggle = document.getElementById("executive_mode");
    const waitTrack = document.getElementById("wait_track");
    let waitTicker = null;
    let meterTicker = null;
    let waitElapsedTicker = null;
    let waitStartedAt = 0;

    function setResultsVisible(visible) {
      if (visible) {
        results.classList.remove("hidden");
        results.hidden = false;
        results.style.display = "grid";
      } else {
        results.classList.add("hidden");
        results.hidden = true;
        results.style.display = "none";
      }
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function toItems(el, list) {
      el.innerHTML = (list || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    }

    function riskClass(level) {
      const value = (level || "").toLowerCase();
      if (value.includes("very high") || value.includes("high")) return "bad";
      if (value.includes("medium")) return "warn";
      return "ok";
    }

    function barClassByScore(score, maxScore) {
      const pct = maxScore > 0 ? (Number(score || 0) / maxScore) * 100 : 0;
      if (pct >= 70) return "fill-good";
      if (pct >= 40) return "fill-warn";
      return "fill-bad";
    }

    function meterClassByPercent(pct, invert = false) {
      const p = Math.max(0, Math.min(100, Number(pct || 0)));
      if (!invert) {
        if (p >= 70) return "fill-good";
        if (p >= 40) return "fill-warn";
        return "fill-bad";
      }
      if (p >= 70) return "fill-bad";
      if (p >= 40) return "fill-warn";
      return "fill-good";
    }

    function setMeterValue(elId, pct, invert = false) {
      const el = document.getElementById(elId);
      if (!el) return;
      const clz = meterClassByPercent(pct, invert);
      el.style.width = `${Math.max(0, Math.min(100, Number(pct || 0)))}%`;
      el.className = `meter-fill ${clz}`;
    }

    function startKpiMeterPulse() {
      if (meterTicker) clearInterval(meterTicker);
      let t = 0;
      meterTicker = setInterval(() => {
        t += 0.22;
        const a = 50 + Math.sin(t) * 35;
        const b = 50 + Math.cos(t * 1.15) * 35;
        setMeterValue("profile_meter", a, false);
        setMeterValue("risk_meter", b, true);
      }, 120);
    }

    function stopKpiMeterPulse() {
      if (meterTicker) {
        clearInterval(meterTicker);
        meterTicker = null;
      }
    }

    function drawBreakdown(breakdown) {
      const root = document.getElementById("breakdown");
      root.innerHTML = "";
      const entries = Object.entries(breakdown || {});
      for (const [key, value] of entries) {
        const row = document.createElement("div");
        row.style.marginBottom = "10px";
        const score = Number(value || 0);
        row.innerHTML = `
          <div class="small">${key.replaceAll("_", " ")}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="bar"><div class="fill ${barClassByScore(score, 10)}" style="width:${Math.max(0, Math.min(100, score * 10))}%"></div></div>
            <div style="width:46px;text-align:right;" class="small">${score}/10</div>
          </div>
        `;
        root.appendChild(row);
      }
    }

    function toDetailedItems(el, list, formatter) {
      el.innerHTML = (list || []).map((x) => `<li>${formatter(x)}</li>`).join("");
    }

    function drawTimeline(timeline) {
      const root = document.getElementById("timeline_plan");
      const t = timeline || {};
      const d30 = (t.day_0_30 || []).join(", ") || "-";
      const d60 = (t.day_31_60 || []).join(", ") || "-";
      const d90 = (t.day_61_90 || []).join(", ") || "-";
      root.innerHTML = `
        <div><strong>Day 0-30:</strong> ${escapeHtml(d30)}</div>
        <div style="margin-top:8px;"><strong>Day 31-60:</strong> ${escapeHtml(d60)}</div>
        <div style="margin-top:8px;"><strong>Day 61-90:</strong> ${escapeHtml(d90)}</div>
      `;
    }

    function drawRecommendations(list) {
      const root = document.getElementById("recommendations_cards");
      const items = Array.isArray(list) ? list.slice(0, 3) : [];
      root.innerHTML = items.map((x) => `
        <div class="rec-card">
          <div class="rec-priority">${escapeHtml(x.priority || "Priority")}</div>
          <div class="rec-action">${escapeHtml(x.action || "-")}</div>
          <div class="rec-reason">${escapeHtml(x.reason || "-")}</div>
        </div>
      `).join("");
      if (!items.length) {
        root.innerHTML = '<div class="small">No recommendations available.</div>';
      }
    }

    function drawCoverage(payload) {
      const fields = [
        payload.name,
        payload.title,
        payload.location,
        payload.summary,
        payload.profile_score,
        payload.score_breakdown,
        payload.ai_risk_assessment,
        payload.top_skills,
        payload.job_recommendations,
        payload.upskilling_plan,
        payload.action_timeline_30_60_90
      ];
      const completeCount = fields.filter((x) => {
        if (Array.isArray(x)) return x.length > 0;
        if (x && typeof x === "object") return Object.keys(x).length > 0;
        return x !== null && x !== undefined && String(x).trim() !== "";
      }).length;
      const pct = Math.round((completeCount / fields.length) * 100);
      const bar = document.getElementById("coverage_bar");
      bar.style.width = `${pct}%`;
      bar.className = `fill ${barClassByScore(pct, 100)}`;
      document.getElementById("coverage_text").textContent = `${pct}% structured profile coverage`;
    }

    function setExecutiveMode(enabled) {
      const compactTargets = [
        document.getElementById("grid_risk_timeline"),
        document.getElementById("grid_upskill_raw")
      ];
      for (const node of compactTargets) {
        if (!node) continue;
        if (enabled) node.classList.add("compact-hidden");
        else node.classList.remove("compact-hidden");
      }
    }

    function startWaitEffect() {
      const phases = [
        "Reading profile input...",
        "Extracting structured experience...",
        "Evaluating AI risk and resilience...",
        "Creating recommendations and timeline...",
        "Finalizing dashboard response..."
      ];
      let idx = 0;
      waitStartedAt = performance.now();
      statusEl.className = "small status-loading";
      statusEl.textContent = `${phases[idx]}...`;
      waitTrack.classList.add("active");
      startKpiMeterPulse();
      if (waitTicker) clearInterval(waitTicker);
      waitTicker = setInterval(() => {
        idx = (idx + 1) % phases.length;
      }, 1250);
      if (waitElapsedTicker) clearInterval(waitElapsedTicker);
      waitElapsedTicker = setInterval(() => {
        const dots = ".".repeat((Math.floor((performance.now() - waitStartedAt) / 500) % 3) + 1);
        statusEl.textContent = `${phases[idx]}${dots}`;
      }, 100);
    }

    function stopWaitEffect() {
      if (waitTicker) {
        clearInterval(waitTicker);
        waitTicker = null;
      }
      if (waitElapsedTicker) {
        clearInterval(waitElapsedTicker);
        waitElapsedTicker = null;
      }
      waitTrack.classList.remove("active");
      statusEl.classList.remove("status-loading");
      stopKpiMeterPulse();
    }

    function resetFlowSections() {
      const sections = document.querySelectorAll("#results .flow-section");
      sections.forEach((el) => el.classList.add("flow-hidden"));
      const panels = document.querySelectorAll("#results .panel");
      panels.forEach((panel) => {
        panel.classList.remove("in");
        panel.classList.add("panel-stagger");
        panel.style.setProperty("--stagger-delay", "0ms");
      });
    }

    async function revealFlowSections() {
      const sections = Array.from(document.querySelectorAll("#results .flow-section"));
      let idx = 0;
      const panels = Array.from(document.querySelectorAll("#results .panel"));
      for (const panel of panels) {
        panel.style.setProperty("--stagger-delay", `${idx * 55}ms`);
        panel.classList.add("in");
        idx += 1;
      }
      for (const el of sections) {
        await new Promise((resolve) => setTimeout(resolve, 110));
        el.classList.remove("flow-hidden");
      }
    }

    exportBtn.addEventListener("click", () => {
      window.print();
    });
    executiveModeToggle.addEventListener("change", () => setExecutiveMode(executiveModeToggle.checked));
    setExecutiveMode(executiveModeToggle.checked);
    setResultsVisible(false);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      startWaitEffect();
      submitBtn.disabled = true;
      setResultsVisible(false);
      sourceChip.classList.add("hidden");
      resetFlowSections();

      try {
        const formData = new FormData(form);
        const res = await fetch("/agent/run-form", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          const detail = data?.detail;
          const message = typeof detail === "string"
            ? detail
            : (detail?.message || detail?.raw_error || "Request failed");
          throw new Error(message);
        }
        const payload = data.result || {};

        const profileScore = Number(payload.profile_score ?? 0).toFixed(1);
        document.getElementById("profile_score").textContent = `${profileScore}/10`;
        const riskScore = Number((payload.ai_risk_assessment || {}).risk_score ?? 0);
        document.getElementById("risk_score").textContent = `${riskScore}/100`;
        setMeterValue("profile_meter", Number(profileScore) * 10, false);
        setMeterValue("risk_meter", riskScore, true);

        const riskLevel = (payload.ai_risk_assessment || {}).overall_risk || "-";
        const riskEl = document.getElementById("risk_level");
        riskEl.className = `small ${riskClass(riskLevel)}`;
        riskEl.textContent = riskLevel;
        const riskPill = document.getElementById("risk_level_pill");
        riskPill.className = `risk-pill risk-pill-${riskClass(riskLevel)}`;
        riskPill.textContent = `Risk: ${riskLevel}`;
        riskPill.classList.remove("hidden");

        const years = Number(payload.years_experience ?? 0);
        const roles = Number(payload.roles_held ?? 0);
        document.getElementById("exp_years").textContent = `${years}`;
        document.getElementById("exp_roles").textContent = `${roles}`;
        document.getElementById("exp_years_bar").style.width = `${Math.max(0, Math.min(100, (years / 20) * 100))}%`;
        document.getElementById("exp_roles_bar").style.width = `${Math.max(0, Math.min(100, (roles / 12) * 100))}%`;
        document.getElementById("exp_note").textContent = `${years >= 8 ? "Strong tenure depth" : "Growing tenure depth"} | ${roles >= 4 ? "Good role diversity" : "Limited role diversity"}`;
        document.getElementById("headline").textContent = `${payload.name || "-"} | ${payload.title || "-"}`;
        document.getElementById("location").textContent = payload.location || "-";
        document.getElementById("summary").textContent = payload.summary || "-";
        document.getElementById("risk_summary").textContent = (payload.ai_risk_assessment || {}).summary || "-";
        document.getElementById("recommendation").textContent = (payload.ai_risk_assessment || {}).recommendation || "-";
        const hi = ((payload.ai_risk_assessment || {}).high_risk_skills || []).length;
        const lo = ((payload.ai_risk_assessment || {}).low_risk_skills || []).length;
        const total = hi + lo;
        const pct = total ? Math.round((hi / total) * 100) : 50;
        document.getElementById("risk_split_bar").style.width = `${pct}%`;

        drawBreakdown(payload.score_breakdown || {});
        const insights = payload.insights || {};
        toItems(document.getElementById("strengths"), insights.strengths || payload.strengths || []);
        toItems(document.getElementById("gaps"), insights.gaps || payload.gaps || []);
        toItems(document.getElementById("skills"), payload.top_skills || []);
        toItems(document.getElementById("risk_drivers"), ((payload.ai_risk_assessment || {}).risk_drivers || []));
        toDetailedItems(document.getElementById("job_recommendations"), payload.job_recommendations || [], (x) => {
          const role = escapeHtml(x.role || "-");
          const fit = x.fit_score ?? "-";
          const reason = escapeHtml(x.reason || "-");
          return `<strong>${role}</strong> (${escapeHtml(fit)}/100) - ${reason}`;
        });
        toDetailedItems(document.getElementById("upskilling_plan"), payload.upskilling_plan || [], (x) => {
          const skill = escapeHtml(x.skill || "-");
          const priority = escapeHtml(x.priority || "-");
          const why = escapeHtml(x.why || "-");
          return `<strong>${skill}</strong> [${priority}] - ${why}`;
        });
        drawRecommendations(payload.recommendations || []);
        drawCoverage(payload);
        drawTimeline(payload.action_timeline_30_60_90 || {});

        const source = payload.data_source || data.data_source || "unknown";
        sourceChip.textContent = `Data source: ${source}`;
        sourceChip.classList.remove("hidden");
        setResultsVisible(true);
        results.classList.add("fade-in");
        await revealFlowSections();
        stopWaitEffect();
        statusEl.className = "small";
        statusEl.textContent = `Done. Steps: ${(data.trace || []).length}`;
      } catch (err) {
        stopWaitEffect();
        setResultsVisible(false);
        statusEl.className = "small";
        statusEl.textContent = `Error: ${err?.message || "Request failed"}`;
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
"""


@app.get("/health")
async def health() -> JSONResponse:
    """Liveness endpoint."""
    return JSONResponse({"status": "ok"})


@app.get("/ready")
async def ready() -> JSONResponse:
    """Readiness endpoint with key checks."""
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


@app.post("/agent/run", response_model=AgentRunResponse)
async def agent_run(payload: AgentRunRequest) -> AgentRunResponse:
    """JSON API for full agent execution."""
    try:
        return await _run_agent(payload.linkedin_url, payload.resume_text)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agent/run-form", response_model=AgentRunResponse)
async def agent_run_form(
    linkedin_url: str = Form(default=""),
    resume: Optional[UploadFile] = File(default=None),
) -> AgentRunResponse:
    """Form API for dashboard execution."""
    try:
        resume_text = ""
        if resume and (resume.filename or "").strip():
            file_bytes = await resume.read()
            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large. Maximum 10MB.")
            # Ignore empty file selections gracefully.
            if file_bytes:
                resume_text = await extract_text_from_resume(resume.filename or "", file_bytes)
        return await _run_agent(linkedin_url, resume_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Form agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
