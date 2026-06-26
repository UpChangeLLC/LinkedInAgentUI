"""Signup capture endpoints."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signup", tags=["signup"])


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


def _first_name(full_name: Optional[str]) -> str:
    return (full_name or "").strip().split(" ")[0] if (full_name or "").strip() else ""


def _issue_email_verification(row: Any) -> str:
    """Set a fresh 24h verification token on `row`; return the raw token to email."""
    from services.email_auth import make_token, token_expiry

    token = make_token()
    row.email_verified = False
    row.email_verification_token_hash = _hash_token(token)
    row.email_verification_token_expires_at = token_expiry(hours=24)
    return token


async def _enqueue_auth_email(user_id: Any, full_name: Optional[str], template: str, model_extra: Dict[str, Any]) -> None:
    """Queue a transactional auth email (verification / reset). Never raises.

    Also logs the action URL at INFO so the flow is testable while
    EMAIL_PROVIDER=none (no real send happens until a provider is configured).
    """
    from db import _session_factory, db_available

    if user_id is None or not db_available() or not _session_factory:
        return
    try:
        from db_models import EmailQueue

        model = {"first_name": _first_name(full_name), **model_extra}
        async with _session_factory() as session:
            session.add(
                EmailQueue(
                    user_signup_id=user_id,
                    template=template,
                    message_stream="transactional",
                    model=model,
                    scheduled_for=datetime.now(timezone.utc),
                    status="queued",
                )
            )
            await session.commit()
        action_url = model_extra.get("verify_url") or model_extra.get("reset_url") or ""
        logger.info("queued %s email (url=%s)", template, action_url)
    except Exception:
        logger.warning("failed to enqueue %s email", template, exc_info=True)


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
        "email_verified": bool(getattr(row, "email_verified", False)),
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


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)


class ResendVerificationRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)


class RequestPasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)


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
        verify_token = _issue_email_verification(row)

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

        await _enqueue_auth_email(
            row.id,
            row.full_name,
            "email_verification",
            {"verify_url": f"{_frontend_origin()}/?verify={verify_token}"},
        )
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
            verify_token = _issue_email_verification(row)
            session.add(row)
            await session.commit()
            await session.refresh(row)

        await _enqueue_auth_email(
            row.id,
            row.full_name,
            "email_verification",
            {"verify_url": f"{_frontend_origin()}/?verify={verify_token}"},
        )
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


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest) -> JSONResponse:
    """Confirm an email-verification token; marks the account verified."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup
        from services.email_auth import verify_token

        token_hash = _hash_token(body.token)
        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.email_verification_token_hash == token_hash)
                )
            ).scalars().first()
            if not row or not verify_token(
                body.token,
                row.email_verification_token_hash,
                row.email_verification_token_expires_at,
            ):
                return JSONResponse(
                    {"status": "error", "detail": "This verification link is invalid or has expired."},
                    status_code=400,
                )
            row.email_verified = True
            row.email_verification_token_hash = None
            row.email_verification_token_expires_at = None
            await session.commit()
        return JSONResponse({"status": "ok", "email_verified": True})
    except Exception:
        logger.warning("Failed to verify email", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not verify email."}, status_code=500)


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest) -> JSONResponse:
    """Re-issue and re-send the verification email for the current session."""
    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
                )
            ).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)
            if row.email_verified:
                return JSONResponse({"status": "ok", "email_verified": True})
            verify_token = _issue_email_verification(row)
            await session.commit()

        await _enqueue_auth_email(
            row.id,
            row.full_name,
            "email_verification",
            {"verify_url": f"{_frontend_origin()}/?verify={verify_token}"},
        )
        return JSONResponse({"status": "ok", "email_verified": False})
    except Exception:
        logger.warning("Failed to resend verification email", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not resend verification email."}, status_code=500)


@router.post("/request-password-reset")
async def request_password_reset(body: RequestPasswordResetRequest) -> JSONResponse:
    """Email a one-time password-reset link. Always returns ok (no enumeration)."""
    ok_response = JSONResponse(
        {"status": "ok", "detail": "If that email has an account, a reset link is on its way."}
    )
    email = body.email.strip().lower()
    if not _valid_email(email):
        return JSONResponse({"status": "error", "detail": "Invalid email address."}, status_code=400)

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return ok_response

    try:
        from sqlalchemy import select
        from db_models import UserSignup
        from services.email_auth import make_token, token_expiry

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup)
                    .where(UserSignup.email == email)
                    .order_by(UserSignup.created_at.desc())
                    .limit(1)
                )
            ).scalars().first()
            if not row or not row.password_hash:
                # No (password) account — stay silent to avoid account enumeration.
                return ok_response
            token = make_token()
            row.password_reset_token_hash = _hash_token(token)
            row.password_reset_token_expires_at = token_expiry(hours=1)
            await session.commit()
            user_id, full_name = row.id, row.full_name

        await _enqueue_auth_email(
            user_id,
            full_name,
            "password_reset",
            {"reset_url": f"{_frontend_origin()}/?reset={token}"},
        )
        return ok_response
    except Exception:
        logger.warning("Failed to request password reset", exc_info=True)
        return ok_response


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest) -> JSONResponse:
    """Set a new password from a reset token; rotates the session token."""
    if not _valid_password(body.new_password):
        return JSONResponse(
            {
                "status": "error",
                "detail": "Password must be 8-128 characters and include at least one letter and one number.",
            },
            status_code=400,
        )

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Database is not configured."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup
        from services.email_auth import verify_token

        token_hash = _hash_token(body.token)
        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.password_reset_token_hash == token_hash)
                )
            ).scalars().first()
            if not row or not verify_token(
                body.token,
                row.password_reset_token_hash,
                row.password_reset_token_expires_at,
            ):
                return JSONResponse(
                    {"status": "error", "detail": "This reset link is invalid or has expired."},
                    status_code=400,
                )
            row.password_hash = _hash_password(body.new_password)
            row.password_reset_token_hash = None
            row.password_reset_token_expires_at = None
            # Rotate the access token so any existing sessions are invalidated.
            access_token = _new_access_token()
            row.access_token_hash = _hash_token(access_token)
            row.last_login_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(row)
            payload = await _session_payload_with_latest_result(session, row, access_token=access_token)
        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to reset password", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not reset password."}, status_code=500)


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
