"""Career Analyst / Mentor chat API with session memory (Redis or in-process fallback)."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth_deps import optional_session
from services.career_chat_gate import enforce_career_chat_gate, should_mark_used
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
async def get_career_chat_history(session_id: str) -> CareerChatMessageResponse:
    """Return stored transcript (empty reply)."""
    sid = _validate_session_id(session_id)
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
