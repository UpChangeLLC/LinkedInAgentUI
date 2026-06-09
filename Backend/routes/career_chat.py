"""Career Analyst / Mentor chat API with session memory (Redis or in-process fallback)."""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth_deps import optional_session
from services.career_chat_gate import enforce_career_chat_gate, should_mark_used
from services.career_chat_sessions import derive_title, owns_session
from services.entitlements import feature_allowed
from ai_backend import get_selected_ai_client, get_selected_model
from cache import cache_get_json, cache_set_json, redis_available
from services.career_chat_agent import (
    _build_system_prompt,
    run_career_chat_anthropic,
    run_career_chat_openai_compatible,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/career-chat", tags=["career-chat"])

_HISTORY_KEY = "career_chat:hist:v1:{sid}"
_CTX_KEY = "career_chat:ctx:v1:{sid}"
_TTL_SECONDS = 7 * 24 * 3600
_MAX_MESSAGES = 40

# In-process fallback when Redis is unavailable (single-worker dev only).
_memory_hist: Dict[str, List[Dict[str, str]]] = {}
_memory_ctx: Dict[str, str] = {}


def _session_key(sid: str) -> str:
    return _HISTORY_KEY.format(sid=sid)


def _ctx_store_key(sid: str) -> str:
    return _CTX_KEY.format(sid=sid)


def _validate_session_id(raw: str) -> str:
    s = (raw or "").strip()
    if not re.fullmatch(r"[a-zA-Z0-9_-]{8,128}", s):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    return s


async def _load_history(sid: str) -> List[Dict[str, str]]:
    if redis_available():
        data = await cache_get_json(_session_key(sid))
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict) and x.get("role") in {"user", "assistant"}]
        return []
    return list(_memory_hist.get(sid, []))


async def _save_history(sid: str, hist: List[Dict[str, str]]) -> None:
    trimmed = hist[-_MAX_MESSAGES:]
    if redis_available():
        await cache_set_json(_session_key(sid), trimmed, ttl_seconds=_TTL_SECONDS)
    else:
        _memory_hist[sid] = trimmed


async def _load_ctx(sid: str) -> Optional[str]:
    if redis_available():
        from cache import cache_get

        raw = await cache_get(_ctx_store_key(sid))
        return raw
    return _memory_ctx.get(sid)


async def _set_ctx(sid: str, text: str) -> None:
    if redis_available():
        from cache import cache_set

        await cache_set(_ctx_store_key(sid), text[:16000], ttl_seconds=_TTL_SECONDS)
    else:
        _memory_ctx[sid] = text[:16000]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class CareerChatMessageRequest(BaseModel):
    session_id: str = Field(..., description="Client-owned opaque session id")
    message: str = Field(..., min_length=1, max_length=8000)
    assessment_context: Optional[str] = Field(
        default=None,
        max_length=16000,
        description="Optional summary from AI Resilience results to ground the mentor.",
    )


class CareerChatMessageResponse(BaseModel):
    reply: str
    history: List[ChatTurn]


class CareerChatResetRequest(BaseModel):
    session_id: str


@router.post("/message", response_model=CareerChatMessageResponse)
async def post_career_chat_message(
    body: CareerChatMessageRequest,
    request: Request,
    user=Depends(optional_session),
) -> CareerChatMessageResponse:
    sid = _validate_session_id(body.session_id)
    user_text = body.message.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty message")

    # First message free; second hits the paywall for non-premium users.
    enforce_career_chat_gate(user)

    existing_ctx = await _load_ctx(sid)
    if body.assessment_context and body.assessment_context.strip():
        if not existing_ctx:
            await _set_ctx(sid, body.assessment_context.strip())

    assessment_block = (await _load_ctx(sid)) or ""
    system_prompt = _build_system_prompt(assessment_block)

    history = await _load_history(sid)

    provider, client = get_selected_ai_client()

    try:
        if provider == "anthropic":
            reply = await run_career_chat_anthropic(system_prompt, history, user_text)
        else:
            if client is None:
                raise HTTPException(status_code=503, detail="AI client is not configured")
            model = get_selected_model(provider)
            reply, _msgs = await run_career_chat_openai_compatible(
                client,
                model,
                system_prompt,
                history,
                user_text,
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("career_chat LLM failure: %s", exc)
        raise HTTPException(status_code=502, detail="Assistant failed to respond. Please try again.") from exc

    new_hist = [
        *history,
        {"role": "user", "content": user_text},
        {"role": "assistant", "content": reply},
    ]
    await _save_history(sid, new_hist)

    # Consume the one free message for non-premium users (fire-and-forget).
    if should_mark_used(user):
        await _mark_career_chat_used(user.id)

    # Keep the per-user session index fresh (Pro saved threads).
    await _touch_session(user, sid, user_text)

    return CareerChatMessageResponse(
        reply=reply,
        history=[ChatTurn(role=m["role"], content=m["content"]) for m in new_hist],
    )


async def _mark_career_chat_used(user_id) -> None:
    """Set career_chat_free_used=True. Never raises."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return
    try:
        from sqlalchemy import update
        from db_models import UserSignup

        async with _session_factory() as session:
            await session.execute(
                update(UserSignup).where(UserSignup.id == user_id).values(career_chat_free_used=True)
            )
            await session.commit()
    except Exception:
        logger.warning("failed to mark career_chat_free_used", exc_info=True)


@router.get("/history", response_model=CareerChatMessageResponse)
async def get_career_chat_history(
    session_id: str,
    user=Depends(optional_session),
) -> CareerChatMessageResponse:
    """Return stored transcript (empty reply).

    Ownership is enforced: if a session is indexed to an account, only that
    account may read it (closes the prior IDOR where any session_id was
    readable). Anonymous / pre-index sessions remain readable as before.
    """
    sid = _validate_session_id(session_id)
    row = await _load_session_row(sid)
    if not owns_session(user, row):
        raise HTTPException(status_code=404, detail="Session not found")
    history = await _load_history(sid)
    return CareerChatMessageResponse(
        reply="",
        history=[ChatTurn(role=m["role"], content=m["content"]) for m in history],
    )


@router.post("/reset")
async def reset_career_chat(body: CareerChatResetRequest) -> Dict[str, str]:
    """Clear server-side memory for a session. Client should rotate session_id after this."""
    sid = _validate_session_id(body.session_id)
    if redis_available():
        from cache import cache_delete

        await cache_delete(_session_key(sid))
        await cache_delete(_ctx_store_key(sid))
    else:
        _memory_hist.pop(sid, None)
        _memory_ctx.pop(sid, None)
    return {"status": "ok"}


@router.get("/new-session")
async def new_career_chat_session() -> Dict[str, str]:
    """Optional helper: server-generated session id."""
    return {"session_id": uuid.uuid4().hex}


# ── Per-user session index (Pro saved threads) ──────────────────────────────

def _chat_sessions_enabled() -> bool:
    return (os.getenv("FEATURE_CHAT_SESSIONS") or "false").strip().lower() in {"1", "true", "yes", "on"}


async def _load_session_row(sid: str):
    """Return the CareerChatSession row for a sid, or None (DB-optional)."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return None
    try:
        from sqlalchemy import select
        from db_models import CareerChatSession

        async with _session_factory() as session:
            return (
                await session.execute(
                    select(CareerChatSession).where(CareerChatSession.session_id == sid)
                )
            ).scalars().first()
    except Exception:
        logger.warning("failed to load career chat session row", exc_info=True)
        return None


async def _touch_session(user: Any, sid: str, first_user_message: str) -> None:
    """Best-effort: upsert the user's session row + bump last_message_at. Never raises."""
    if user is None or not _chat_sessions_enabled():
        return
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return
    try:
        from sqlalchemy import select
        from db_models import CareerChatSession

        now = datetime.now(timezone.utc)
        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(CareerChatSession).where(CareerChatSession.session_id == sid)
                )
            ).scalars().first()
            if row is None:
                session.add(
                    CareerChatSession(
                        user_signup_id=user.id,
                        session_id=sid,
                        title=derive_title(first_user_message),
                        last_message_at=now,
                    )
                )
            else:
                row.last_message_at = now
            await session.commit()
    except Exception:
        logger.warning("failed to touch career chat session", exc_info=True)


class SessionSummary(BaseModel):
    session_id: str
    title: str
    last_message_at: Optional[str] = None


class CreateSessionResponse(BaseModel):
    session_id: str
    title: str


class RenameSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


@router.get("/sessions", response_model=List[SessionSummary])
async def list_career_chat_sessions(user=Depends(optional_session)) -> List[SessionSummary]:
    """List the signed-in user's saved threads (empty for anonymous users)."""
    if user is None:
        return []
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return []
    from sqlalchemy import select
    from db_models import CareerChatSession

    async with _session_factory() as session:
        rows = (
            await session.execute(
                select(CareerChatSession)
                .where(CareerChatSession.user_signup_id == user.id)
                .order_by(CareerChatSession.last_message_at.desc().nullslast())
            )
        ).scalars().all()
    return [
        SessionSummary(
            session_id=r.session_id,
            title=r.title,
            last_message_at=r.last_message_at.isoformat() if r.last_message_at else None,
        )
        for r in rows
    ]


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_career_chat_session(user=Depends(optional_session)) -> CreateSessionResponse:
    """Create a new saved thread (Pro feature)."""
    if not feature_allowed(user, "career_chat_sessions"):
        raise HTTPException(
            status_code=402,
            detail={"code": "premium_required", "feature": "career_chat_sessions"},
        )
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        raise HTTPException(status_code=503, detail="Sessions are unavailable.")
    from db_models import CareerChatSession

    sid = uuid.uuid4().hex
    async with _session_factory() as session:
        row = CareerChatSession(user_signup_id=user.id, session_id=sid, title="New chat")
        session.add(row)
        await session.commit()
    return CreateSessionResponse(session_id=sid, title="New chat")


@router.patch("/sessions/{sid}")
async def rename_career_chat_session(
    sid: str, body: RenameSessionRequest, user=Depends(optional_session)
) -> Dict[str, str]:
    """Rename a thread (ownership enforced)."""
    sid = _validate_session_id(sid)
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        raise HTTPException(status_code=503, detail="Sessions are unavailable.")
    from sqlalchemy import select
    from db_models import CareerChatSession

    async with _session_factory() as session:
        row = (
            await session.execute(
                select(CareerChatSession).where(CareerChatSession.session_id == sid)
            )
        ).scalars().first()
        if not owns_session(user, row):
            raise HTTPException(status_code=404, detail="Session not found")
        row.title = body.title.strip()[:120]
        await session.commit()
    return {"status": "ok", "title": row.title}


@router.delete("/sessions/{sid}")
async def delete_career_chat_session(sid: str, user=Depends(optional_session)) -> Dict[str, str]:
    """Delete a thread + its stored messages (ownership enforced)."""
    sid = _validate_session_id(sid)
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        raise HTTPException(status_code=503, detail="Sessions are unavailable.")
    from sqlalchemy import select
    from db_models import CareerChatSession

    async with _session_factory() as session:
        row = (
            await session.execute(
                select(CareerChatSession).where(CareerChatSession.session_id == sid)
            )
        ).scalars().first()
        if not owns_session(user, row):
            raise HTTPException(status_code=404, detail="Session not found")
        await session.delete(row)
        await session.commit()

    # Clear the Redis transcript too.
    if redis_available():
        from cache import cache_delete

        await cache_delete(_session_key(sid))
        await cache_delete(_ctx_store_key(sid))
    else:
        _memory_hist.pop(sid, None)
        _memory_ctx.pop(sid, None)
    return {"status": "ok"}
