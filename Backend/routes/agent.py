"""Agent execution endpoints — consolidated from exec_dashboard + exec_dashboard_readiness."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
import uuid as _uuid_mod
from typing import List, Optional, Dict, Any

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sse_starlette.sse import EventSourceResponse

from auth_deps import optional_session, require_session
from services.rerun_gate import enforce_rerun_gate
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


async def _upsert_profile(
    url_hash: str,
    linkedin_url: str = "",
    display_name: str = "",
    title: str = "",
    company: str = "",
) -> Optional[_uuid_mod.UUID]:
    """Upsert a profile row and return its UUID. Fire-and-forget safe."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory or not url_hash:
        return None
    try:
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        from sqlalchemy import select, literal
        from db_models import Profile
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        profile_id = _uuid_mod.uuid4()
        values = {
            "id": profile_id,
            "url_hash": url_hash,
            "linkedin_url": linkedin_url or None,
            "display_name": display_name or None,
            "title": title or None,
            "company": company or None,
            "first_assessed_at": now,
            "last_assessed_at": now,
            "assessment_count": 1,
        }
        async with _session_factory() as session:
            stmt = pg_insert(Profile).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["url_hash"],
                set_={
                    "last_assessed_at": now,
                    "assessment_count": Profile.assessment_count + 1,
                    "linkedin_url": stmt.excluded.linkedin_url,
                    "display_name": sa_func_coalesce(
                        stmt.excluded.display_name, Profile.display_name
                    ),
                    "title": sa_func_coalesce(
                        stmt.excluded.title, Profile.title
                    ),
                    "company": sa_func_coalesce(
                        stmt.excluded.company, Profile.company
                    ),
                },
            )
            await session.execute(stmt)
            await session.commit()

            # Retrieve the actual profile_id (may differ if row already existed)
            row = (await session.execute(
                select(Profile.id).where(Profile.url_hash == url_hash)
            )).scalar_one_or_none()
        return row
    except Exception:
        logger.warning("Failed to upsert profile", exc_info=True)
        return None


def sa_func_coalesce(new_val, existing_val):
    """SQL COALESCE — use new value if not NULL, else keep existing."""
    from sqlalchemy import func
    return func.coalesce(new_val, existing_val)


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
    profile_id=None,
    resilience_score: Optional[int] = None,
    readiness_score: Optional[int] = None,
) -> None:
    """Insert a new assessment history entry. Fire-and-forget."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory or not url_hash:
        return
    try:
        from db_models import AssessmentHistory

        entry = AssessmentHistory(
            id=_uuid_mod.uuid4(),
            url_hash=url_hash,
            score=score,
            dimension_scores=dimension_scores,
            risk_band=risk_band,
            pipeline_run_id=pipeline_run_id,
            profile_id=profile_id,
            resilience_score=resilience_score,
            readiness_score=readiness_score,
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
    profile_id: Optional[_uuid_mod.UUID] = None,
    user_signup_id: Optional[_uuid_mod.UUID] = None,
) -> Optional[_uuid_mod.UUID]:
    """Insert pipeline_runs + analytics_events rows. Fire-and-forget; never raises.

    Returns the generated run_id UUID on success, None on failure.
    """
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return None
    try:
        from db_models import PipelineRun, AnalyticsEvent

        data_source = (result or {}).get("data_source", "unknown") if result else None
        ai_client = os.getenv("AI_CLIENT", "openai")
        ai_model = os.getenv("OPENAI_MODEL", "")

        run_id = _uuid_mod.uuid4()
        run = PipelineRun(
            id=run_id,
            linkedin_url=linkedin_url or None,
            url_hash=_hash_url(linkedin_url) if linkedin_url else None,
            resume_provided=resume_provided,
            profile_id=profile_id,
            user_signup_id=user_signup_id,
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
            await session.flush()  # Ensure PipelineRun row exists before FK reference

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
        return run_id
    except Exception:
        logger.warning("Failed to record pipeline run", exc_info=True)
        return None


async def _store_survey_responses(
    *,
    run_id: _uuid_mod.UUID,
    user_signup_id: Optional[_uuid_mod.UUID],
    url_hash: Optional[str],
    responses: Dict[str, Any],
) -> None:
    """Persist onboarding survey answers. Fire-and-forget; never raises."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return
    try:
        from db_models import SurveyResponses

        async with _session_factory() as session:
            session.add(
                SurveyResponses(
                    run_id=run_id,
                    user_signup_id=user_signup_id,
                    url_hash=url_hash,
                    responses=responses,
                )
            )
            await session.commit()
    except Exception:
        logger.warning("Failed to store survey responses", exc_info=True)


async def _record_ml_inference(
    *,
    run_id: Optional[_uuid_mod.UUID],
    user_signup_id: Optional[_uuid_mod.UUID],
    result: Dict[str, Any],
) -> None:
    """Write one ml_inference_log row from the score result. Never raises.

    Reads the ephemeral `_ml_meta` stamped by `ml_client.score_profile` and
    pops it so it doesn't leak into the API response.
    """
    from services.ml_client import ML_META_KEY

    meta = result.pop(ML_META_KEY, None) if isinstance(result, dict) else None
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return
    try:
        from db_models import MlInferenceLog

        meta = meta or {}
        async with _session_factory() as session:
            session.add(
                MlInferenceLog(
                    pipeline_run_id=run_id,
                    user_signup_id=user_signup_id,
                    scoring_version=str(result.get("scoring_version") or "v0")[:10],
                    model_version=meta.get("model_version"),
                    onet_version=meta.get("onet_version"),
                    platform_attempted=bool(meta.get("platform_attempted", False)),
                    fell_back=bool(meta.get("fell_back", False)),
                    latency_ms=meta.get("latency_ms"),
                    error=meta.get("error"),
                    resilience_score=result.get("resilience_score"),
                    readiness_score=result.get("readiness_score"),
                    shap_attribution=result.get("shap_attribution") or [],
                )
            )
            await session.commit()
    except Exception:
        logger.warning("Failed to record ml inference log", exc_info=True)


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
    user_signup_id: Optional[_uuid_mod.UUID] = None,
    survey_responses: Optional[Dict[str, Any]] = None,
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
            survey_responses=survey_responses,
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

        # F22: Compute score delta from previous assessment.
        # Canonical displayed score = resilience (v1); for v0, resilience == profile_score.
        current_score = int(result.get("resilience_score") or result.get("profile_score") or 0)
        current_readiness = int(result.get("readiness_score") or current_score)
        current_dims = result.get("dimension_scores", {}) or {}
        delta_data = await _compute_score_delta(url_hash, current_score, current_dims)
        if delta_data:
            result["score_delta"] = delta_data

        # Upsert profile and get profile_id
        profile_id = None
        if url_hash:
            overall_for_profile = result.get("overall_assessment", {}) or {}
            profile_id = await _upsert_profile(
                url_hash=url_hash,
                linkedin_url=linkedin,
                display_name=result.get("name", ""),
                title=overall_for_profile.get("best_fit_benchmark_role", ""),
                company=result.get("company", ""),
            )

        # Record to database (fire-and-forget) — now returns run_id
        run_id = await _record_pipeline_run(
            linkedin_url=linkedin,
            resume_provided=bool(resume),
            result=result,
            trace=[t.model_dump() for t in trace],
            duration_ms=duration_ms,
            request=request,
            profile_id=profile_id,
            user_signup_id=user_signup_id,
        )

        # Persist survey responses (fire-and-forget) once the run row exists.
        if survey_responses and run_id:
            await _store_survey_responses(
                run_id=run_id,
                user_signup_id=user_signup_id,
                url_hash=url_hash,
                responses=survey_responses,
            )

        # WS-C: audit which scorer produced this result (v0/v1 + fall-through).
        await _record_ml_inference(
            run_id=run_id,
            user_signup_id=user_signup_id,
            result=result,
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
                pipeline_run_id=run_id,
                profile_id=profile_id,
                resilience_score=current_score,
                readiness_score=current_readiness,
            )

        # F24: Store action items if present in result
        action_items_data = result.get("action_items", [])
        if action_items_data and url_hash:
            from routes.actions import store_action_items
            await store_action_items(
                url_hash, action_items_data,
                pipeline_run_id=run_id,
                profile_id=profile_id,
            )

        # WS-D: schedule lifecycle emails (welcome/drip/decay) for signed-in users.
        if user_signup_id:
            from services.email_lifecycle import enqueue_assessment_emails
            await enqueue_assessment_emails(user_signup_id, result)

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

        # Record failure (profile_id may not be available on error)
        url_hash = _hash_url(linkedin) if linkedin else None
        profile_id = await _upsert_profile(url_hash=url_hash, linkedin_url=linkedin) if url_hash else None
        await _record_pipeline_run(
            linkedin_url=linkedin,
            resume_provided=bool(resume),
            result=None,
            trace=None,
            duration_ms=duration_ms,
            error=str(exc),
            request=request,
            profile_id=profile_id,
            user_signup_id=user_signup_id,
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
async def mcp_run(
    payload: AgentRunRequest,
    request: Request,
    user=Depends(require_session),
) -> AgentRunResponse:
    """Primary JSON API endpoint (used by frontend SPA). Hard auth gate + re-run cadence."""
    await enforce_rerun_gate(user)
    include_market = _env_bool("MARKET_SIGNALS_ENABLE", False)
    ctx = payload.user_context.model_dump() if payload.user_context else None
    return await _run_agent(
        payload.linkedin_url, payload.resume_text,
        include_market_signals=include_market, request=request,
        user_context=ctx,
        github_url=payload.github_url,
        website_url=payload.website_url,
        user_signup_id=getattr(user, "id", None),
        survey_responses=payload.survey_responses,
    )


@router.post("/agent/run", response_model=AgentRunResponse)
async def agent_run(
    payload: AgentRunRequest,
    request: Request,
    user=Depends(require_session),
) -> AgentRunResponse:
    """JSON API for agent execution (alias)."""
    await enforce_rerun_gate(user)
    include_market = _env_bool("MARKET_SIGNALS_ENABLE", False)
    ctx = payload.user_context.model_dump() if payload.user_context else None
    return await _run_agent(
        payload.linkedin_url, payload.resume_text,
        include_market_signals=include_market, request=request,
        user_context=ctx,
        github_url=payload.github_url,
        website_url=payload.website_url,
        user_signup_id=getattr(user, "id", None),
        survey_responses=payload.survey_responses,
    )


@router.post("/agent/run-form", response_model=AgentRunResponse)
async def agent_run_form(
    request: Request,
    linkedin_url: str = Form(default=""),
    resume: Optional[UploadFile] = File(default=None),
    include_market: Optional[str] = Form(default=None),
    user=Depends(require_session),
) -> AgentRunResponse:
    """Form API with file upload support."""
    try:
        await enforce_rerun_gate(user)
        resume_text = ""
        if resume and (resume.filename or "").strip():
            file_bytes = await resume.read()
            if len(file_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large. Maximum 10MB.")
            if file_bytes:
                resume_text = await extract_text_from_resume(resume.filename or "", file_bytes)
        user_toggle = str(include_market or "").strip().lower() in ("1", "true", "yes", "on", "checked")
        return await _run_agent(
            linkedin_url, resume_text, include_market_signals=user_toggle, request=request,
            user_signup_id=getattr(user, "id", None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Form agent execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mcp/run/stream")
async def mcp_run_stream(
    payload: AgentRunRequest,
    request: Request,
    user=Depends(require_session),
):
    """SSE endpoint that streams real-time pipeline progress events.

    Each event is a JSON-encoded PipelineEvent. The final event has
    event_type='pipeline_complete' and includes the full result payload.
    """
    await enforce_rerun_gate(user)
    linkedin_url = (payload.linkedin_url or "").strip()
    resume_text = (payload.resume_text or "").strip()
    if not linkedin_url and not resume_text:
        raise HTTPException(status_code=400, detail="Provide linkedin_url or resume_text.")

    ctx = payload.user_context.model_dump() if payload.user_context else None
    user_signup_id = getattr(user, "id", None)

    async def _record_streaming_run(
        final_result: Optional[Dict[str, Any]],
        final_trace: Optional[Any],
        error_info: Optional[str],
        duration_ms: int,
    ) -> None:
        """Fire-and-forget DB recording for a streaming pipeline run."""
        try:
            url_hash = _hash_url(linkedin_url) if linkedin_url else None
            profile_id = None
            if url_hash and final_result:
                overall = final_result.get("overall_assessment", {}) or {}
                profile_id = await _upsert_profile(
                    url_hash=url_hash,
                    linkedin_url=linkedin_url,
                    display_name=final_result.get("name", ""),
                    title=overall.get("best_fit_benchmark_role", ""),
                    company=final_result.get("company", ""),
                )
            elif url_hash:
                profile_id = await _upsert_profile(url_hash=url_hash, linkedin_url=linkedin_url)

            run_id = await _record_pipeline_run(
                linkedin_url=linkedin_url,
                resume_provided=bool(resume_text),
                result=final_result,
                trace=final_trace,
                duration_ms=duration_ms,
                error=error_info,
                request=request,
                profile_id=profile_id,
                user_signup_id=user_signup_id,
            )

            if final_result and not error_info:
                await _record_ml_inference(
                    run_id=run_id,
                    user_signup_id=user_signup_id,
                    result=final_result,
                )

            if url_hash and final_result and not error_info:
                # Canonical score = resilience (v1); v0 has resilience == profile_score.
                current_score = int(final_result.get("resilience_score") or final_result.get("profile_score") or 0)
                current_readiness = int(final_result.get("readiness_score") or current_score)
                current_dims = final_result.get("dimension_scores", {}) or {}
                overall = final_result.get("overall_assessment", {}) or {}
                risk_band = overall.get("ai_readiness", "")
                await _store_assessment_history(
                    url_hash=url_hash,
                    score=current_score,
                    dimension_scores=current_dims,
                    risk_band=risk_band,
                    pipeline_run_id=run_id,
                    profile_id=profile_id,
                    resilience_score=current_score,
                    readiness_score=current_readiness,
                )

                action_items_data = final_result.get("action_items", [])
                if action_items_data:
                    from routes.actions import store_action_items
                    await store_action_items(
                        url_hash, action_items_data,
                        pipeline_run_id=run_id,
                        profile_id=profile_id,
                    )

                if user_signup_id:
                    from services.email_lifecycle import enqueue_assessment_emails
                    await enqueue_assessment_emails(user_signup_id, final_result)
        except Exception:
            logger.warning("Failed to record streaming pipeline run", exc_info=True)

    async def event_generator():
        start = time.perf_counter()
        final_result = None
        final_trace = None
        error_info = None

        async for event_dict in run_pipeline_streaming(
            linkedin_url=linkedin_url,
            resume_text=resume_text,
            user_context=ctx,
            github_url=(payload.github_url or "").strip(),
            website_url=(payload.website_url or "").strip(),
        ):
            event_type = event_dict.get("event_type", "message")

            # Capture the final result for DB recording
            if event_type == "pipeline_complete":
                partial = event_dict.get("partial_result", {})
                if isinstance(partial, dict):
                    final_result = partial.get("result") or partial
                    final_trace = partial.get("trace")
            elif event_type == "pipeline_error":
                error_info = event_dict.get("info", "Unknown error")

            yield {
                "event": event_type,
                "data": json.dumps(event_dict),
            }

        # After streaming completes, record to DB (fire-and-forget via task)
        duration_ms = int((time.perf_counter() - start) * 1000)
        asyncio.create_task(
            _record_streaming_run(final_result, final_trace, error_info, duration_ms)
        )

    return EventSourceResponse(event_generator())


@router.post("/mcp/preview")
async def mcp_preview(
    payload: AgentRunRequest,
    request: Request,
    user=Depends(optional_session),
):
    """Fast profile preview — runs fetch + extract only (no LLM analysis).

    Stays public (rate-limited): the scrape kicks off pre-signup, in parallel
    with the survey. ``optional_session`` resolves the user when present but
    never blocks anonymous callers.

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


MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/api/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    """Parse an uploaded resume and return extracted text.

    Accepts PDF, DOCX, and TXT files up to 5MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF, DOCX, or TXT file.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_RESUME_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    try:
        text = await extract_text_from_resume(file.filename, file_bytes)
    except Exception as exc:
        logger.exception("Resume parsing failed")
        raise HTTPException(status_code=400, detail=f"Could not parse resume: {exc}") from exc

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

    # Return basic stats for preview
    lines = [l for l in text.split("\n") if l.strip()]
    word_count = len(text.split())

    return {
        "status": "ok",
        "resume_text": text,
        "stats": {
            "word_count": word_count,
            "line_count": len(lines),
            "file_name": file.filename,
            "file_size_bytes": len(file_bytes),
        },
    }
