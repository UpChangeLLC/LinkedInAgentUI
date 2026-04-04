"""Agent execution endpoints — consolidated from exec_dashboard + exec_dashboard_readiness."""

from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import List, Optional, Dict, Any

import json

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from sse_starlette.sse import EventSourceResponse

from models import AgentRunRequest, AgentRunResponse, AgentTraceStep
from ai_backend import extract_text_from_resume, run_pipeline_with_trace, run_pipeline_streaming, run_preview

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _env_bool(name: str, default: bool = False) -> bool:
    raw = (os.getenv(name, "") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return default


def _normalize_error_message(error_text: str) -> str:
    """Convert backend exception text into user-friendly message."""
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
    result: Dict[str, Any], enabled: bool
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
        enriched.append({**rec, **enrich})
    result["job_recommendations"] = enriched
    return result


# ---------------------------------------------------------------------------
# Database recording helpers
# ---------------------------------------------------------------------------

def _hash_url(url: str) -> Optional[str]:
    if not url:
        return None
    return hashlib.sha256(url.strip().lower().rstrip("/").encode()).hexdigest()


def _ip_hash(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else "unknown")
    return hashlib.sha256(ip.encode()).hexdigest()


def _role_category(role: str) -> str:
    """Map specific role to anonymized category."""
    r = (role or "").lower()
    if any(t in r for t in ("ceo", "coo", "cfo", "cto", "cmo", "chief")):
        return "C-Suite"
    if "vp" in r or "vice president" in r:
        return "VP-Level"
    if "director" in r:
        return "Director"
    if "manager" in r:
        return "Manager"
    return "Individual Contributor"


async def _compute_score_delta(url_hash: str, current_score: int, current_dims: dict) -> Optional[Dict[str, Any]]:
    """Look up previous assessment and compute deltas. Returns None if no history."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory or not url_hash:
        return None
    try:
        from sqlalchemy import select
        from db_models import AssessmentHistory

        async with _session_factory() as session:
            stmt = (
                select(AssessmentHistory)
                .where(AssessmentHistory.url_hash == url_hash)
                .order_by(AssessmentHistory.created_at.desc())
                .limit(1)
            )
            prev = (await session.execute(stmt)).scalar_one_or_none()
            if not prev:
                return None

            # Compute dimension deltas
            prev_dims = prev.dimension_scores or {}
            dim_deltas = {}
            for key in current_dims:
                cur_val = current_dims[key].get("score", 0) if isinstance(current_dims[key], dict) else 0
                prev_val = prev_dims.get(key, {}).get("score", 0) if isinstance(prev_dims.get(key), dict) else 0
                dim_deltas[key] = round((cur_val - prev_val) * 20)  # 1-5 scale → 0-100

            days_since = (
                __import__("datetime").datetime.now(__import__("datetime").timezone.utc) - prev.created_at
            ).days

            return {
                "previous_score": prev.score,
                "score_delta": current_score - prev.score,
                "previous_risk_band": prev.risk_band or "",
                "days_since_last": days_since,
                "dimension_deltas": dim_deltas,
                "previous_assessment_date": prev.created_at.isoformat() if prev.created_at else None,
            }
    except Exception:
        logger.warning("Failed to compute score delta", exc_info=True)
        return None


async def _store_assessment_history(
    url_hash: str,
    score: int,
    dimension_scores: dict,
    risk_band: str,
    pipeline_run_id=None,
) -> None:
    """Insert a new assessment history entry. Fire-and-forget."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory or not url_hash:
        return
    try:
        from db_models import AssessmentHistory
        import uuid as _uuid

        entry = AssessmentHistory(
            id=_uuid.uuid4(),
            url_hash=url_hash,
            score=score,
            dimension_scores=dimension_scores,
            risk_band=risk_band,
            pipeline_run_id=pipeline_run_id,
        )
        async with _session_factory() as session:
            session.add(entry)
            await session.commit()
    except Exception:
        logger.warning("Failed to store assessment history", exc_info=True)


async def _record_pipeline_run(
    *,
    linkedin_url: str,
    resume_provided: bool,
    result: Optional[Dict[str, Any]],
    trace: Optional[List[Dict[str, Any]]],
    duration_ms: int,
    error: Optional[str] = None,
    error_node: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Insert pipeline_runs + analytics_events rows. Fire-and-forget; never raises."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return
    try:
        from db_models import PipelineRun, AnalyticsEvent
        import uuid

        data_source = (result or {}).get("data_source", "unknown") if result else None
        ai_client = os.getenv("AI_CLIENT", "openai")
        ai_model = os.getenv("OPENAI_MODEL", "")

        run_id = uuid.uuid4()
        run = PipelineRun(
            id=run_id,
            linkedin_url=linkedin_url or None,
            url_hash=_hash_url(linkedin_url) if linkedin_url else None,
            resume_provided=resume_provided,
            data_source=data_source,
            ai_client=ai_client,
            ai_model=ai_model,
            duration_ms=duration_ms,
            result=result,
            trace=trace,
            error=error,
            error_node=error_node,
            client_ip_hash=_ip_hash(request),
            user_agent=request.headers.get("user-agent", "")[:500] if request else None,
        )

        async with _session_factory() as session:
            session.add(run)

            # Emit analytics event
            if result and not error:
                assessment = result.get("overall_assessment", {}) or {}
                score = result.get("profile_score")
                role = assessment.get("best_fit_benchmark_role", "")
                event = AnalyticsEvent(
                    event_type="assessment_completed",
                    event_metadata={
                        "score": score,
                        "role_category": _role_category(role),
                        "data_source": data_source,
                        "duration_ms": duration_ms,
                    },
                    pipeline_run_id=run_id,
                )
                session.add(event)
            elif error:
                event = AnalyticsEvent(
                    event_type="assessment_failed",
                    event_metadata={
                        "error_node": error_node,
                        "error_type": type(error).__name__ if not isinstance(error, str) else "error",
                    },
                    pipeline_run_id=run_id,
                )
                session.add(event)

            await session.commit()
    except Exception:
        logger.warning("Failed to record pipeline run", exc_info=True)


# ---------------------------------------------------------------------------
# Core pipeline runner
# ---------------------------------------------------------------------------

async def _run_agent(
    linkedin_url: str,
    resume_text: str,
    include_market_signals: bool = False,
    request: Optional[Request] = None,
    user_context: Optional[Dict[str, Any]] = None,
    github_url: str = "",
    website_url: str = "",
) -> AgentRunResponse:
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
        result, node_trace = await run_pipeline_with_trace(
            linkedin_url=linkedin, resume_text=resume,
            user_context=user_context,
            github_url=github_url.strip(),
            website_url=website_url.strip(),
        )

        # Optional market signals enrichment
        env_enabled = _env_bool("MARKET_SIGNALS_ENABLE", False)
        effective_enabled = bool(env_enabled and include_market_signals)
        result = _enrich_job_recommendations_with_market_signals(result, effective_enabled)

        duration_ms = int((time.perf_counter() - start) * 1000)
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
                duration_ms=duration_ms,
                info=f"source={result.get('data_source', 'unknown')}",
            )
        )

        # Include URL hash for frontend action tracker API calls
        url_hash = _hash_url(linkedin) if linkedin else None
        if url_hash:
            result["_url_hash"] = url_hash

        # F22: Compute score delta from previous assessment
        current_score = int(result.get("profile_score", 0))
        current_dims = result.get("dimension_scores", {}) or {}
        delta_data = await _compute_score_delta(url_hash, current_score, current_dims)
        if delta_data:
            result["score_delta"] = delta_data

        # Record to database (fire-and-forget)
        await _record_pipeline_run(
            linkedin_url=linkedin,
            resume_provided=bool(resume),
            result=result,
            trace=[t.model_dump() for t in trace],
            duration_ms=duration_ms,
            request=request,
        )

        # F22: Store assessment history for future delta computations
        if url_hash:
            overall = result.get("overall_assessment", {}) or {}
            risk_band = overall.get("ai_readiness", "")
            await _store_assessment_history(
                url_hash=url_hash,
                score=current_score,
                dimension_scores=current_dims,
                risk_band=risk_band,
            )

        # F24: Store action items if present in result
        action_items_data = result.get("action_items", [])
        if action_items_data and url_hash:
            from routes.actions import store_action_items
            await store_action_items(url_hash, action_items_data)

        return AgentRunResponse(
            status="ok",
            data_source=result.get("data_source", "unknown"),
            trace=trace,
            result=result,
        )
    except HTTPException:
        raise
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.exception("Agent pipeline failed")

        # Record failure
        await _record_pipeline_run(
            linkedin_url=linkedin,
            resume_provided=bool(resume),
            result=None,
            trace=None,
            duration_ms=duration_ms,
            error=str(exc),
            request=request,
        )

        friendly = _normalize_error_message(str(exc))
        raise HTTPException(
            status_code=400,
            detail={
                "message": friendly,
                "raw_error": str(exc),
                "retryable": True,
            },
        ) from exc


# ---------------------------------------------------------------------------
# Route definitions
# ---------------------------------------------------------------------------

@router.post("/mcp/run", response_model=AgentRunResponse)
async def mcp_run(payload: AgentRunRequest, request: Request) -> AgentRunResponse:
    """Primary JSON API endpoint (used by frontend SPA)."""
    include_market = _env_bool("MARKET_SIGNALS_ENABLE", False)
    ctx = payload.user_context.model_dump() if payload.user_context else None
    return await _run_agent(
        payload.linkedin_url, payload.resume_text,
        include_market_signals=include_market, request=request,
        user_context=ctx,
        github_url=payload.github_url,
        website_url=payload.website_url,
    )


@router.post("/agent/run", response_model=AgentRunResponse)
async def agent_run(payload: AgentRunRequest, request: Request) -> AgentRunResponse:
    """JSON API for agent execution (alias)."""
    include_market = _env_bool("MARKET_SIGNALS_ENABLE", False)
    ctx = payload.user_context.model_dump() if payload.user_context else None
    return await _run_agent(
        payload.linkedin_url, payload.resume_text,
        include_market_signals=include_market, request=request,
        user_context=ctx,
        github_url=payload.github_url,
        website_url=payload.website_url,
    )


@router.post("/agent/run-form", response_model=AgentRunResponse)
async def agent_run_form(
    request: Request,
    linkedin_url: str = Form(default=""),
    resume: Optional[UploadFile] = File(default=None),
    include_market: Optional[str] = Form(default=None),
) -> AgentRunResponse:
    """Form API with file upload support."""
    try:
        resume_text = ""
        if resume and (resume.filename or "").strip():
            file_bytes = await resume.read()
            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large. Maximum 10MB.")
            if file_bytes:
                resume_text = await extract_text_from_resume(resume.filename or "", file_bytes)
        user_toggle = str(include_market or "").strip().lower() in ("1", "true", "yes", "on", "checked")
        return await _run_agent(linkedin_url, resume_text, include_market_signals=user_toggle, request=request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Form agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mcp/run/stream")
async def mcp_run_stream(payload: AgentRunRequest, request: Request):
    """SSE endpoint that streams real-time pipeline progress events.

    Each event is a JSON-encoded PipelineEvent. The final event has
    event_type='pipeline_complete' and includes the full result payload.
    """
    linkedin_url = (payload.linkedin_url or "").strip()
    resume_text = (payload.resume_text or "").strip()
    if not linkedin_url and not resume_text:
        raise HTTPException(status_code=400, detail="Provide linkedin_url or resume_text.")

    ctx = payload.user_context.model_dump() if payload.user_context else None

    async def event_generator():
        async for event_dict in run_pipeline_streaming(
            linkedin_url=linkedin_url,
            resume_text=resume_text,
            user_context=ctx,
            github_url=(payload.github_url or "").strip(),
            website_url=(payload.website_url or "").strip(),
        ):
            yield {
                "event": event_dict.get("event_type", "message"),
                "data": json.dumps(event_dict),
            }

    return EventSourceResponse(event_generator())


@router.post("/mcp/preview")
async def mcp_preview(payload: AgentRunRequest, request: Request):
    """Fast profile preview — runs fetch + extract only (no LLM analysis).

    Returns a lightweight profile summary with completeness score so the user
    can confirm the right profile before committing to the full analysis.
    """
    linkedin_url = (payload.linkedin_url or "").strip()
    resume_text = (payload.resume_text or "").strip()
    if not linkedin_url and not resume_text:
        raise HTTPException(status_code=400, detail="Provide linkedin_url or resume_text.")

    try:
        preview = await run_preview(linkedin_url=linkedin_url, resume_text=resume_text)
        return {"status": "ok", "preview": preview}
    except Exception as exc:
        logger.exception("Preview failed")
        friendly = _normalize_error_message(str(exc))
        raise HTTPException(
            status_code=400,
            detail={"message": friendly, "raw_error": str(exc), "retryable": True},
        ) from exc
