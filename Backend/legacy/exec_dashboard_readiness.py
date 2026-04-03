"""Executive dashboard (AI Readiness) aligned to AI_READINESS_SYSTEM_PROMPT schema."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
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

app = FastAPI(title="AI Readiness Exec Dashboard")


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


def _env_bool(name: str, default: bool = False) -> bool:
    try:
        raw = (os.getenv(name, "") or "").strip().lower()
        if raw in ("1", "true", "yes", "on"):
            return True
        if raw in ("0", "false", "no", "off"):
            return False
        return bool(default)
    except Exception:
        return bool(default)


def _build_market_sources_for_role(role: str) -> Dict[str, Any]:
    """Generate zero-API market discovery links for a role."""
    q_role = (role or "AI role").replace(" ", "+")
    queries = [
        ("Google News", f"https://news.google.com/search?q={q_role}+hiring+2026"),
        ("Google Search", f"https://www.google.com/search?q={q_role}+market+trends+2026"),
        ("LinkedIn Jobs", f"https://www.linkedin.com/jobs/search/?keywords={q_role}"),
        ("GitHub Trending AI", "https://github.com/trending?since=monthly"),
    ]
    return {
        "trend_signals": [
            "Validate demand with current news and job postings",
            "Cross-check sector-specific growth signals",
        ],
        "sources": [{"title": t, "url": u} for (t, u) in queries],
        "market_fit_note": f"Role '{role}' appears aligned with current AI adoption; validate in target industry.",
    }


def _enrich_job_recommendations_with_market_signals(
    result: Dict[str, Any],
    enabled: bool,
) -> Dict[str, Any]:
    if not enabled:
        return result
    recs = list(result.get("job_recommendations") or [])
    if not recs:
        return result
    enriched: List[Dict[str, Any]] = []
    for rec in recs:
        role = (rec or {}).get("role") or ""
        enrich = _build_market_sources_for_role(role)
        enriched.append(
            {
                **rec,
                "trend_signals": enrich["trend_signals"],
                "sources": enrich["sources"],
                "market_fit_note": enrich["market_fit_note"],
            }
        )
    result["job_recommendations"] = enriched
    return result


async def _run_agent(linkedin_url: str, resume_text: str, include_market_signals: bool = False) -> AgentRunResponse:
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
        # Apply optional market enrichment (requires both env enable and request flag when using form route)
        env_enabled = _env_bool("MARKET_SIGNALS_ENABLE", False)
        effective_enabled = bool(env_enabled and include_market_signals)
        result = _enrich_job_recommendations_with_market_signals(result, effective_enabled)
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
                info=f"source={result.get('data_source', 'unknown')}, market_signals={'on' if effective_enabled else 'off'}",
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
    """Serve AI Readiness executive dashboard page."""
    return """
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>AI Readiness Dashboard</title>
  <style>
    :root {
      --bg: #f6f9ff;
      --panel: #ffffff;
      --text: #0f1a2e;
      --muted: #6b7a99;
      --line: #e2e8f6;
      --brand: #4f46e5;
      --ok: #16a34a;
      --warn: #f59e0b;
      --bad: #ef4444;
      --shadow: 0 12px 26px rgba(36, 63, 137, .12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--text);
      background: linear-gradient(180deg, #f9fbff 0%, #eef3ff 60%, #e9efff 100%);
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 22px; }
    .title { font-size: 42px; font-weight: 900; margin: 4px 0 6px 0; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); margin: 0 0 12px 0; }
    .grid { display: grid; gap: 14px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 16px; box-shadow: var(--shadow); }
    .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
    input, button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--text);
      padding: 12px;
      font-size: 14px;
    }
    button {
      margin-top: 10px;
      background: linear-gradient(90deg, #4f46e5, #7c3aed);
      color: #fff; border: none; font-weight: 700; cursor: pointer;
    }
    .badge {
      display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid transparent;
    }
    .badge-ok { background: rgba(22,163,74,.12); color: #16a34a; border-color: rgba(22,163,74,.25); }
    .badge-warn { background: rgba(245,158,11,.12); color: #f59e0b; border-color: rgba(245,158,11,.25); }
    .badge-bad { background: rgba(239,68,68,.12); color: #ef4444; border-color: rgba(239,68,68,.25); }
    .meter { height: 10px; width: 100%; background: #f3f6ff; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
    .meter-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #7c3aed, #4f46e5); transition: width 240ms ease; }
    .score { font-size: 28px; font-weight: 800; }
    .dim-row { border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #fafbff; }
    .dim-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
    ul { margin: 8px 0 0 18px; color: var(--muted); }
    .small { font-size: 13px; color: var(--muted); }
    .rec-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, 1fr); }
    .rec-card { border: 1px solid var(--line); border-radius: 12px; background: #fbfcff; padding: 12px; }
    .rec-title { font-size: 12px; text-transform: uppercase; color: var(--muted); letter-spacing: .06em; }
    .rec-action { font-weight: 700; margin-top: 4px; }
    .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #edf2ff; border: 1px solid #d7e0ff; color: #2b3c6b; font-size: 12px; font-weight: 700; }
    .hidden { display: none; }
    @media (max-width: 900px) { .grid-2, .grid-3, .rec-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="container">
    <h1 class="title">AI Readiness - Executive Dashboard</h1>
    <p class="subtitle">Generate a candid, action-focused AI readiness assessment from LinkedIn and/or resume.</p>
    <div id="source_chip" class="chip hidden"></div>

    <div class="panel">
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
        <div style="margin-top:10px; display:flex; align-items:center; gap:10px;">
          <input type="checkbox" id="include_market" name="include_market"/>
          <label for="include_market" class="small">Include market signals (if enabled in config)</label>
        </div>
        <button id="submitBtn" type="submit">Generate AI Readiness</button>
      </form>
      <div id="status" class="small" style="margin-top:10px;"></div>
    </div>

    <section id="results" class="grid hidden" hidden style="margin-top:14px;">
      <div id="structured_container" class="panel">
        <div class="label">Executive Summary</div>
        <p id="executive_summary" class="small" style="line-height:1.5;"></p>
      </div>

      <div id="structured_kpis" class="grid grid-3">
        <div class="panel">
          <div class="label">AI Readiness</div>
          <div id="ai_readiness_badge" class="badge">-</div>
        </div>
        <div class="panel">
          <div class="label">Confidence</div>
          <div id="confidence_badge" class="badge">-</div>
        </div>
        <div class="panel">
          <div class="label">Best-Fit Benchmark Role</div>
          <div id="benchmark_role" class="score">-</div>
        </div>
      </div>

      <div id="structured_dimensions" class="panel">
        <div class="label">Dimension Scores (1–5)</div>
        <div id="dimensions" class="dim-grid"></div>
      </div>

      <div id="structured_lists" class="grid grid-2">
        <div class="panel">
          <div class="label">Top Strengths</div>
          <ul id="top_strengths"></ul>
        </div>
        <div class="panel">
          <div class="label">Top Gaps / Risks</div>
          <ul id="top_gaps_risks"></ul>
        </div>
      </div>

      <div id="structured_reco" class="panel">
        <div class="label">Recommended Next 90 Days (3 actions)</div>
        <div id="reco_grid" class="rec-grid"></div>
      </div>

      <div id="structured_unknowns" class="panel">
        <div class="label">Unknowns That Would Change The Assessment</div>
        <ul id="unknowns"></ul>
      </div>

      <div id="market_panel" class="panel hidden">
        <div class="label">Market Signals (per role)</div>
        <ul id="market_notes" class="small"></ul>
      </div>
    </section>
  </main>

  <script>
    const form = document.getElementById("analyzeForm");
    const results = document.getElementById("results");
    const statusEl = document.getElementById("status");
    const submitBtn = document.getElementById("submitBtn");
    const sourceChip = document.getElementById("source_chip");
    const structuredBlocks = [
      document.getElementById("structured_container"),
      document.getElementById("structured_kpis"),
      document.getElementById("structured_dimensions"),
      document.getElementById("structured_lists"),
      document.getElementById("structured_reco"),
      document.getElementById("structured_unknowns"),
    ];
    const marketPanel = document.getElementById("market_panel");
    const marketNotes = document.getElementById("market_notes");

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

    function riskBadgeClass(level) {
      const v = (level || "").toLowerCase();
      if (v.includes("high")) return "badge-bad";
      if (v.includes("medium")) return "badge-warn";
      if (v.includes("low")) return "badge-ok";
      return "";
    }

    function confidenceClass(level) {
      const v = (level || "").toLowerCase();
      if (v.includes("high")) return "badge-ok";
      if (v.includes("moderate")) return "badge-warn";
      if (v.includes("low")) return "badge-bad";
      return "";
    }

    function renderDimensions(dimensions) {
      const el = document.getElementById("dimensions");
      const ordered = [
        "ai_fluency",
        "technical_proximity",
        "governance_awareness",
        "learning_velocity",
        "leadership_readiness",
        "network_relevance",
        "automation_exposure",
        "execution_credibility",
      ];
      const blocks = ordered.map((key) => {
        const item = (dimensions || {})[key] || {};
        const score = Number(item.score || 0);
        const rationale = String(item.rationale || "-");
        const pct = Math.max(0, Math.min(100, (score / 5) * 100));
        const label = key.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
        return `
          <div class="dim-row">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div><strong>${escapeHtml(label)}</strong></div>
              <div class="score">${escapeHtml(score.toFixed(0))}/5</div>
            </div>
            <div class="meter" style="margin:8px 0 6px 0;"><div class="meter-fill" style="width:${pct}%"></div></div>
            <div class="small">${escapeHtml(rationale)}</div>
          </div>
        `;
      }).join("");
      el.innerHTML = blocks;
    }

    function toList(el, arr, formatter) {
      const list = Array.isArray(arr) ? arr : [];
      el.innerHTML = list.map(formatter).join("");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setResultsVisible(false);
      statusEl.textContent = "Generating AI readiness assessment...";
      submitBtn.disabled = true;
      sourceChip.classList.add("hidden");

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
        const payload = data.result ?? {};
        structuredBlocks.forEach((el) => el && el.classList.remove("hidden"));

        document.getElementById("executive_summary").textContent = payload.executive_summary || "-";

        const overall = payload.overall_assessment || {};
        const readiness = overall.ai_readiness || "-";
        const confidence = overall.confidence_level || "-";
        const role = overall.best_fit_benchmark_role || "-";

        const readinessEl = document.getElementById("ai_readiness_badge");
        readinessEl.textContent = readiness;
        readinessEl.className = `badge ${riskBadgeClass(readiness)}`;

        const confEl = document.getElementById("confidence_badge");
        confEl.textContent = confidence;
        confEl.className = `badge ${confidenceClass(confidence)}`;

        document.getElementById("benchmark_role").textContent = role;

        renderDimensions(payload.dimension_scores || {});

        toList(document.getElementById("top_strengths"), payload.top_strengths || [], (x) => {
          const t = escapeHtml(x.title || "-");
          const w = escapeHtml(x.why_it_matters || "-");
          const evi = escapeHtml(x.evidence || "-");
          return `<li><strong>${t}</strong> — ${w}. Evidence: ${evi}</li>`;
        });

        toList(document.getElementById("top_gaps_risks"), payload.top_gaps_risks || [], (x) => {
          const t = escapeHtml(x.title || "-");
          const sev = escapeHtml(x.severity || "-");
          const w = escapeHtml(x.why_it_matters || "-");
          const evi = escapeHtml(x.evidence || "-");
          const inf = escapeHtml(x.inference_note || "");
          const note = inf ? ` <em>(${inf})</em>` : "";
          return `<li><strong>${t}</strong> [${sev}] — ${w}. Evidence: ${evi}.${note}</li>`;
        });

        const recos = Array.isArray(payload.recommended_next_moves_90_days) ? payload.recommended_next_moves_90_days.slice(0, 3) : [];
        const recRoot = document.getElementById("reco_grid");
        recRoot.innerHTML = recos.map((x) => `
          <div class="rec-card">
            <div class="rec-title">${escapeHtml(x.priority || "Priority")}</div>
            <div class="rec-action">${escapeHtml(x.action || "-")}</div>
            <div class="small">${escapeHtml(x.reason || "-")}</div>
          </div>
        `).join("");
        if (!recos.length) recRoot.innerHTML = '<div class="small">No actions available.</div>';

        toList(document.getElementById("unknowns"), payload.unknowns_that_would_change_assessment || [], (x) => `<li>${escapeHtml(x || "-")}</li>`);

        // Market panel rendering when backend enriched job recommendations
        const jrecs = Array.isArray(payload.job_recommendations) ? payload.job_recommendations : [];
        if (jrecs.some(r => Array.isArray(r?.sources) || Array.isArray(r?.trend_signals) || (r?.market_fit_note))) {
          const items = jrecs.map((r) => {
            const title = escapeHtml(r.role || "Role");
            const note = escapeHtml(r.market_fit_note || "");
            const trends = (r.trend_signals || []).map(t => `<li>${escapeHtml(t)}</li>`).join("");
            const sources = (r.sources || []).map(s => {
              const t = escapeHtml(s.title || s.url || "source");
              const u = escapeHtml(s.url || "#");
              return `<li><a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a></li>`;
            }).join("");
            return `
              <li style="margin-bottom:10px;">
                <strong>${title}</strong>${note ? ` — ${note}` : ""}
                ${trends ? `<div class="small" style="margin-top:6px;"><em>Signals</em><ul>${trends}</ul></div>` : ""}
                ${sources ? `<div class="small" style="margin-top:6px;"><em>Sources</em><ul>${sources}</ul></div>` : ""}
              </li>
            `;
          }).join("");
          marketNotes.innerHTML = items;
          marketPanel.classList.remove("hidden");
        } else {
          marketPanel.classList.add("hidden");
          marketNotes.innerHTML = "";
        }

        const source = payload.data_source || data.data_source || "unknown";
        sourceChip.textContent = `Data source: ${source}`;
        sourceChip.classList.remove("hidden");

        setResultsVisible(true);
        statusEl.textContent = "Done.";
      } catch (err) {
        statusEl.textContent = `Error: ${err?.message || "Request failed"}`;
        setResultsVisible(false);
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
        # Use env toggle only for JSON API route
        include_market = _env_bool("MARKET_SIGNALS_ENABLE", False)
        return await _run_agent(payload.linkedin_url, payload.resume_text, include_market_signals=include_market)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agent/run-form", response_model=AgentRunResponse)
async def agent_run_form(
    linkedin_url: str = Form(default=""),
    resume: Optional[UploadFile] = File(default=None),
    include_market: Optional[str] = Form(default=None),
) -> AgentRunResponse:
    """Form API for dashboard execution."""
    try:
        resume_text = ""
        if resume and (resume.filename or "").strip():
            file_bytes = await resume.read()
            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large. Maximum 10MB.")
            if file_bytes:
                resume_text = await extract_text_from_resume(resume.filename or "", file_bytes)
        user_toggle = str(include_market or "").strip().lower() in ("1", "true", "yes", "on", "checked")
        return await _run_agent(linkedin_url, resume_text, include_market_signals=user_toggle)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Form agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)

