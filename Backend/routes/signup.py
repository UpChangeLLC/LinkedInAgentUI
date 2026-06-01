"""Signup capture endpoints."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signup", tags=["signup"])
_oauth_state_memory: Dict[str, Dict[str, Any]] = {}


def _hash_url(url: str) -> Optional[str]:
    value = (url or "").strip()
    if not value:
        return None
    return hashlib.sha256(value.lower().rstrip("/").encode()).hexdigest()


def _valid_email(email: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()))


# Auth primitives now live in services.auth_service (single implementation,
# shared with payments.py and auth_deps.py). Kept as module-local aliases so the
# rest of this file is unchanged.
from services.auth_service import (  # noqa: E402
    hash_password as _hash_password,
    hash_token as _hash_token,
    is_subscription_active as _is_active,
    new_access_token as _new_access_token,
    verify_password as _verify_password,
)


def _valid_password(password: str) -> bool:
    if len(password) < 8 or len(password) > 128:
        return False
    has_alpha = any(ch.isalpha() for ch in password)
    has_digit = any(ch.isdigit() for ch in password)
    return has_alpha and has_digit


def _session_payload(row: Any, access_token: Optional[str] = None) -> Dict[str, Any]:
    expires = row.subscription_expires_at
    active = _is_active(row.subscription_status, expires)
    latest_result = row.assessment_snapshot if isinstance(row.assessment_snapshot, dict) else None
    latest_created_at = None
    if latest_result:
        latest_created_at = latest_result.get("_saved_at") or row.created_at.isoformat()
    payload = {
        "status": "ok",
        "persisted": True,
        "signup_id": str(row.id),
        "email": row.email,
        "full_name": row.full_name,
        "access_token": access_token,
        "subscription_status": row.subscription_status,
        "subscription_active": active,
        "subscription_expires_at": expires.isoformat() if expires else None,
        "latest_assessment_result": latest_result if latest_result else None,
        "latest_assessment_created_at": latest_created_at,
    }
    return payload


async def _session_payload_with_latest_result(session: Any, row: Any, access_token: Optional[str] = None) -> Dict[str, Any]:
    """Build session payload and prefer the latest full pipeline result over compact signup metadata."""
    payload = _session_payload(row, access_token=access_token)
    if not row.url_hash:
        return payload
    try:
        from sqlalchemy import select
        from db_models import PipelineRun

        latest = (
            await session.execute(
                select(PipelineRun.result, PipelineRun.created_at)
                .where(
                    PipelineRun.url_hash == row.url_hash,
                    PipelineRun.result.isnot(None),
                    PipelineRun.error.is_(None),
                )
                .order_by(PipelineRun.created_at.desc())
                .limit(1)
            )
        ).first()
        if latest and isinstance(latest.result, dict):
            payload["latest_assessment_result"] = latest.result
            payload["latest_assessment_created_at"] = latest.created_at.isoformat()
    except Exception:
        logger.debug("Could not load latest pipeline result for signup session", exc_info=True)
    return payload


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    role_title: Optional[str] = Field(default=None, max_length=200)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    resume_provided: bool = False
    resume_text_length: int = 0
    github_url: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)
    user_context: Dict[str, Any] = Field(default_factory=dict)
    assessment_snapshot: Dict[str, Any] = Field(default_factory=dict)
    marketing_opt_in: bool = False


class OnboardingSignupRequest(BaseModel):
    """Lighter mid-onboarding signup — defers phone/company/role to post-signup."""

    # Length validation is done in the handler (_valid_email/_valid_password)
    # so failures return a friendly 400 rather than a Pydantic 422.
    full_name: str = Field(default="", max_length=200)
    email: str = Field(default="", max_length=320)
    password: str = Field(default="", max_length=128)
    marketing_opt_in: bool = False
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    linkedin_run_id: Optional[str] = Field(default=None, max_length=64)


class SignupSessionRequest(BaseModel):
    email: Optional[str] = Field(default=None, min_length=5, max_length=320)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    access_token: Optional[str] = Field(default=None, min_length=16, max_length=256)


class DummySubscribeRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    months: int = Field(default=1, ge=1, le=12)


class OAuthCompleteRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    resume_provided: bool = False
    resume_text_length: int = 0
    github_url: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)
    user_context: Dict[str, Any] = Field(default_factory=dict)
    assessment_snapshot: Dict[str, Any] = Field(default_factory=dict)


class SaveAssessmentRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    resume_provided: bool = False
    resume_text_length: int = 0
    github_url: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)
    user_context: Dict[str, Any] = Field(default_factory=dict)
    assessment_snapshot: Dict[str, Any] = Field(default_factory=dict)


def _frontend_origin() -> str:
    return (os.getenv("FRONTEND_ORIGIN") or os.getenv("PUBLIC_FRONTEND_URL") or "/").strip().rstrip("/")


def _backend_public_url(request: Request) -> str:
    configured = (os.getenv("BACKEND_PUBLIC_URL") or os.getenv("PUBLIC_BACKEND_URL") or "").strip().rstrip("/")
    if configured:
        return configured
    return str(request.base_url).rstrip("/")


def _oauth_redirect_uri(request: Request, provider: str) -> str:
    return f"{_backend_public_url(request)}/api/signup/oauth/callback/{provider}"


async def _store_oauth_state(state: str, payload: Dict[str, Any]) -> None:
    try:
        from cache import cache_set_json, redis_available

        if redis_available():
            await cache_set_json(f"oauth_state:{state}", payload, ttl_seconds=600)
            return
    except Exception:
        pass
    _oauth_state_memory[state] = payload


async def _pop_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    try:
        from cache import cache_delete, cache_get_json, redis_available

        if redis_available():
            payload = await cache_get_json(f"oauth_state:{state}")
            await cache_delete(f"oauth_state:{state}")
            return payload if isinstance(payload, dict) else None
    except Exception:
        pass
    return _oauth_state_memory.pop(state, None)


def _oauth_config(provider: str) -> Dict[str, str]:
    if provider == "google":
        return {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip(),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", "").strip(),
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
            "scope": "openid email profile",
        }
    if provider == "linkedin":
        return {
            "client_id": os.getenv("LINKEDIN_CLIENT_ID", "").strip(),
            "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET", "").strip(),
            "auth_url": "https://www.linkedin.com/oauth/v2/authorization",
            "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
            "userinfo_url": "https://api.linkedin.com/v2/userinfo",
            "scope": "openid profile email",
        }
    raise ValueError("Unsupported OAuth provider")


def _encode_auth_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    import base64

    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


@router.get("/oauth/start/{provider}")
async def start_oauth(provider: str, request: Request) -> JSONResponse:
    """Return provider authorization URL for Google/LinkedIn signup/login."""
    provider = provider.strip().lower()
    try:
        cfg = _oauth_config(provider)
    except ValueError:
        return JSONResponse({"status": "error", "detail": "Unsupported OAuth provider."}, status_code=400)
    if not cfg["client_id"] or not cfg["client_secret"]:
        return JSONResponse({"status": "error", "detail": f"{provider.title()} OAuth is not configured."}, status_code=503)

    state = secrets.token_urlsafe(24)
    await _store_oauth_state(state, {"provider": provider, "created_at": datetime.now(timezone.utc).isoformat()})
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": _oauth_redirect_uri(request, provider),
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
    }
    return JSONResponse({"status": "ok", "auth_url": f"{cfg['auth_url']}?{urlencode(params)}"})


@router.get("/oauth/callback/{provider}")
async def oauth_callback(provider: str, request: Request, code: str = "", state: str = ""):
    """OAuth callback. Creates/restores a user and redirects token payload to the SPA."""
    provider = provider.strip().lower()
    state_payload = await _pop_oauth_state(state)
    frontend = _frontend_origin()
    if not code or not state_payload or state_payload.get("provider") != provider:
        return RedirectResponse(f"{frontend}/#auth_error=oauth_state")

    try:
        cfg = _oauth_config(provider)
        import httpx

        async with httpx.AsyncClient(timeout=20.0) as client:
            token_resp = await client.post(
                cfg["token_url"],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": _oauth_redirect_uri(request, provider),
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_resp.raise_for_status()
            token_payload = token_resp.json()
            access = token_payload.get("access_token", "")
            user_resp = await client.get(cfg["userinfo_url"], headers={"Authorization": f"Bearer {access}"})
            user_resp.raise_for_status()
            userinfo = user_resp.json()
    except Exception:
        logger.warning("OAuth callback failed for provider=%s", provider, exc_info=True)
        return RedirectResponse(f"{frontend}/#auth_error=oauth_failed")

    email = (userinfo.get("email") or "").strip().lower()
    subject = str(userinfo.get("sub") or userinfo.get("id") or "").strip()
    full_name = (
        userinfo.get("name")
        or " ".join(x for x in [userinfo.get("given_name"), userinfo.get("family_name")] if x)
        or email
        or "OAuth User"
    )
    if not subject:
        return RedirectResponse(f"{frontend}/#auth_error=missing_identity")

    try:
        from sqlalchemy import select
        from db import _session_factory, db_available
        from db_models import UserSignup

        if not db_available() or not _session_factory:
            raise RuntimeError("Database is not configured")

        async with _session_factory() as session:
            stmt = select(UserSignup).where(
                UserSignup.oauth_provider == provider,
                UserSignup.oauth_subject == subject,
            )
            row = (await session.execute(stmt)).scalars().first()
            if row is None and email:
                row = (
                    await session.execute(
                        select(UserSignup).where(UserSignup.email == email).order_by(UserSignup.created_at.desc()).limit(1)
                    )
                ).scalars().first()
            if row is None:
                row = UserSignup(
                    full_name=full_name,
                    email=email or f"{provider}-{subject}@oauth.local",
                    oauth_provider=provider,
                    oauth_subject=subject,
                    subscription_status="trial",
                    created_at=datetime.now(timezone.utc),
                )
                session.add(row)
            else:
                row.oauth_provider = row.oauth_provider or provider
                row.oauth_subject = row.oauth_subject or subject
                row.full_name = row.full_name or full_name
                if email:
                    row.email = row.email or email
            access_token = _new_access_token()
            row.access_token_hash = _hash_token(access_token)
            row.last_login_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(row)
    except Exception:
        logger.warning("OAuth user persistence failed", exc_info=True)
        return RedirectResponse(f"{frontend}/#auth_error=persistence_failed")

    async with _session_factory() as session:
        payload = await _session_payload_with_latest_result(session, row, access_token=access_token)
    payload["oauth_provider"] = provider
    return RedirectResponse(f"{frontend}/#auth={_encode_auth_payload(payload)}")


@router.post("")
async def create_signup(body: SignupRequest) -> JSONResponse:
    """Persist contact details before unlocking the dashboard."""
    from db import _session_factory, db_available

    email = body.email.strip().lower()
    if not _valid_email(email):
        return JSONResponse({"status": "error", "detail": "Invalid email address."}, status_code=400)
    if not _valid_password(body.password):
        return JSONResponse(
            {
                "status": "error",
                "detail": "Password must be 8-128 characters and include at least one letter and one number.",
            },
            status_code=400,
        )

    if not db_available() or not _session_factory:
        # Keep local/dev flows usable, but make persistence status explicit.
        logger.warning("Signup received but DATABASE_URL is not configured; details were not persisted.")
        return JSONResponse(
            {
                "status": "ok",
                "persisted": False,
                "signup_id": None,
                "access_token": _new_access_token(),
                "subscription_status": "trial",
                "subscription_active": False,
                "subscription_expires_at": None,
            }
        )

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        snapshot = dict(body.assessment_snapshot or {})
        if snapshot:
            snapshot.setdefault("resume_text_length", body.resume_text_length)
            snapshot.setdefault("_saved_at", datetime.now(timezone.utc).isoformat())

        row = UserSignup(
            full_name=body.full_name.strip(),
            email=email,
            phone=(body.phone or "").strip() or None,
            company=(body.company or "").strip() or None,
            role_title=(body.role_title or "").strip() or None,
            linkedin_url=(body.linkedin_url or "").strip() or None,
            url_hash=_hash_url(body.linkedin_url or ""),
            resume_provided=body.resume_provided,
            github_url=(body.github_url or "").strip() or None,
            website_url=(body.website_url or "").strip() or None,
            user_context=body.user_context or {},
            assessment_snapshot=snapshot or None,
            marketing_opt_in=body.marketing_opt_in,
            created_at=datetime.now(timezone.utc),
        )
        access_token = _new_access_token()
        row.access_token_hash = _hash_token(access_token)
        row.password_hash = _hash_password(body.password)
        row.subscription_status = "trial"

        async with _session_factory() as session:
            existing = (
                await session.execute(
                    select(UserSignup.id).where(UserSignup.email == email).limit(1)
                )
            ).first()
            if existing:
                return JSONResponse(
                    {
                        "status": "error",
                        "detail": "An account with this email already exists. Please log in instead.",
                    },
                    status_code=409,
                )
            session.add(row)
            await session.commit()
            await session.refresh(row)

        return JSONResponse(_session_payload(row, access_token=access_token))
    except Exception:
        logger.warning("Failed to persist signup", exc_info=True)
        return JSONResponse(
            {"status": "error", "detail": "Could not save signup details."},
            status_code=500,
        )


@router.post("/onboarding")
async def create_onboarding_signup(body: OnboardingSignupRequest) -> JSONResponse:
    """Mid-onboarding signup gate (spec 01 §5). Lighter than the full signup —
    only name/email/password — but persists through the same UserSignup path and
    returns the same session payload so the frontend stores it identically.
    """
    from db import _session_factory, db_available

    email = body.email.strip().lower()
    if not _valid_email(email):
        return JSONResponse({"status": "error", "detail": "Invalid email address."}, status_code=400)
    if not _valid_password(body.password):
        return JSONResponse(
            {
                "status": "error",
                "detail": "Password must be 8-128 characters and include at least one letter and one number.",
            },
            status_code=400,
        )

    if not db_available() or not _session_factory:
        logger.warning("Onboarding signup received but DATABASE_URL is not configured; not persisted.")
        return JSONResponse(
            {
                "status": "ok",
                "persisted": False,
                "signup_id": None,
                "email": email,
                "full_name": body.full_name.strip(),
                "access_token": _new_access_token(),
                "subscription_status": "trial",
                "subscription_active": False,
                "subscription_expires_at": None,
                "is_returning_user": False,
            }
        )

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        async with _session_factory() as session:
            existing = (
                await session.execute(
                    select(UserSignup.id).where(UserSignup.email == email).limit(1)
                )
            ).first()
            if existing:
                # Returning user — frontend swaps to login mode (spec 01 §8.6).
                return JSONResponse(
                    {
                        "status": "error",
                        "is_returning_user": True,
                        "detail": "An account with this email already exists. Please log in instead.",
                    },
                    status_code=409,
                )

            row = UserSignup(
                full_name=body.full_name.strip(),
                email=email,
                linkedin_url=(body.linkedin_url or "").strip() or None,
                url_hash=_hash_url(body.linkedin_url or ""),
                marketing_opt_in=body.marketing_opt_in,
                subscription_status="trial",
                created_at=datetime.now(timezone.utc),
            )
            access_token = _new_access_token()
            row.access_token_hash = _hash_token(access_token)
            row.password_hash = _hash_password(body.password)
            session.add(row)
            await session.commit()
            await session.refresh(row)

        payload = _session_payload(row, access_token=access_token)
        payload["is_returning_user"] = False
        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to persist onboarding signup", exc_info=True)
        return JSONResponse(
            {"status": "error", "detail": "Could not save signup details."},
            status_code=500,
        )


@router.post("/session")
async def restore_signup_session(body: SignupSessionRequest) -> JSONResponse:
    """Restore a session by local token or email."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    if not body.access_token and not body.email:
        return JSONResponse({"status": "error", "detail": "Provide access_token or email."}, status_code=400)

    if body.email and not _valid_email(body.email.strip().lower()):
        return JSONResponse({"status": "error", "detail": "Invalid email address."}, status_code=400)
    if body.email and not body.access_token and not body.password:
        return JSONResponse({"status": "error", "detail": "Password is required."}, status_code=400)

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        async with _session_factory() as session:
            if body.access_token:
                stmt = select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
            else:
                stmt = (
                    select(UserSignup)
                    .where(UserSignup.email == body.email.strip().lower())
                    .order_by(UserSignup.created_at.desc())
                    .limit(1)
                )
            row = (await session.execute(stmt)).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Signup not found."}, status_code=404)
            if body.email and not body.access_token:
                if not _verify_password(body.password or "", row.password_hash):
                    return JSONResponse({"status": "error", "detail": "Invalid email or password."}, status_code=401)

            # Rotate token when restoring by email, keep same token when validating existing session.
            access_token = body.access_token or _new_access_token()
            row.access_token_hash = _hash_token(access_token)
            row.last_login_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(row)
            payload = await _session_payload_with_latest_result(session, row, access_token=access_token)

        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to restore signup session", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not restore session."}, status_code=500)


@router.post("/oauth/complete")
async def complete_oauth_signup(body: OAuthCompleteRequest) -> JSONResponse:
    """Attach current assessment/intake metadata to an OAuth-created session."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        snapshot = dict(body.assessment_snapshot or {})
        if snapshot:
            snapshot.setdefault("resume_text_length", body.resume_text_length)
            snapshot.setdefault("_saved_at", datetime.now(timezone.utc).isoformat())

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
                )
            ).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)
            row.linkedin_url = (body.linkedin_url or "").strip() or row.linkedin_url
            row.url_hash = _hash_url(body.linkedin_url or "") or row.url_hash
            row.resume_provided = body.resume_provided
            row.github_url = (body.github_url or "").strip() or row.github_url
            row.website_url = (body.website_url or "").strip() or row.website_url
            row.user_context = body.user_context or row.user_context
            if snapshot:
                row.assessment_snapshot = snapshot
            await session.commit()
            await session.refresh(row)
            payload = await _session_payload_with_latest_result(session, row, access_token=body.access_token)
        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to complete OAuth signup", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not complete OAuth signup."}, status_code=500)


@router.post("/assessment")
async def save_signup_assessment(body: SaveAssessmentRequest) -> JSONResponse:
    """Save the latest full assessment against the signed-in user."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        snapshot = dict(body.assessment_snapshot or {})
        if not snapshot:
            return JSONResponse({"status": "error", "detail": "Assessment result is required."}, status_code=400)
        snapshot.setdefault("resume_text_length", body.resume_text_length)
        snapshot["_saved_at"] = datetime.now(timezone.utc).isoformat()

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
                )
            ).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)
            row.linkedin_url = (body.linkedin_url or "").strip() or row.linkedin_url
            row.url_hash = _hash_url(body.linkedin_url or "") or row.url_hash
            row.resume_provided = body.resume_provided
            row.github_url = (body.github_url or "").strip() or row.github_url
            row.website_url = (body.website_url or "").strip() or row.website_url
            row.user_context = body.user_context or row.user_context
            row.assessment_snapshot = snapshot
            await session.commit()
            await session.refresh(row)
        return JSONResponse(_session_payload(row, access_token=body.access_token))
    except Exception:
        logger.warning("Failed to save user assessment", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not save assessment."}, status_code=500)


@router.post("/subscribe")
async def dummy_subscribe(body: DummySubscribeRequest) -> JSONResponse:
    """Dummy paywall payment endpoint: marks subscription active for N months."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        expires = datetime.now(timezone.utc) + timedelta(days=30 * body.months)
        return JSONResponse(
            {
                "status": "ok",
                "persisted": False,
                "subscription_status": "active",
                "subscription_active": True,
                "subscription_expires_at": expires.isoformat(),
            }
        )

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        async with _session_factory() as session:
            stmt = select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
            row = (await session.execute(stmt)).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)

            row.subscription_status = "active"
            row.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30 * body.months)
            row.last_login_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(row)

        return JSONResponse(_session_payload(row, access_token=body.access_token))
    except Exception:
        logger.warning("Failed to activate dummy subscription", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not activate subscription."}, status_code=500)
