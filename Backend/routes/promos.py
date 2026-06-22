"""Promotional code endpoints.

Free-month codes (EARLYBIRD, FIFA) are redeemed here: we activate Pro directly,
enforce the per-code 25-slot cap (a row count in ``promo_redemptions``) and the
one-per-user rule (a unique index), and never touch a payment provider.

Percentage-discount codes (FIFA50) are *not* granted here — they are entered by
the customer on the Stripe checkout page (Stripe enforces the 50% coupon and its
own redemption limit). For those we just validate and tell the client to proceed
to checkout with the code.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.auth_service import hash_token, is_subscription_active
from services.promos import Promo, get_promo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/promos", tags=["promos"])


class RedeemRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    code: str = Field(..., min_length=2, max_length=60)


def _session_payload(row: Any, access_token: Optional[str] = None) -> Dict[str, Any]:
    expires = row.subscription_expires_at
    return {
        "status": "ok",
        "persisted": True,
        "signup_id": str(row.id),
        "email": row.email,
        "full_name": row.full_name,
        "access_token": access_token,
        "subscription_status": row.subscription_status,
        "subscription_tier": getattr(row, "subscription_tier", "free"),
        "subscription_active": is_subscription_active(row.subscription_status, expires),
        "subscription_expires_at": expires.isoformat() if expires else None,
    }


def _promo_info(promo: Promo, remaining: Optional[int]) -> Dict[str, Any]:
    return {
        "code": promo.code,
        "kind": promo.kind,
        "label": promo.label,
        "months": promo.months,
        "percent_off": promo.percent_off,
        "apply_at_checkout": promo.is_discount,
        "remaining": remaining,
    }


async def _redeemed_count(session: Any, code: str) -> int:
    from sqlalchemy import func, select
    from db_models import PromoRedemption

    result = await session.execute(
        select(func.count()).select_from(PromoRedemption).where(PromoRedemption.code == code)
    )
    return int(result.scalar() or 0)


@router.get("/{code}")
async def validate_promo(code: str) -> JSONResponse:
    """Validate a code and report remaining slots (for the frontend to preview)."""
    promo = get_promo(code)
    if not promo:
        return JSONResponse({"status": "error", "valid": False, "detail": "That code isn't valid."}, status_code=404)

    remaining: Optional[int] = None
    if promo.is_free:
        from db import _session_factory, db_available

        if db_available() and _session_factory:
            try:
                async with _session_factory() as session:
                    used = await _redeemed_count(session, promo.code)
                    remaining = max(0, promo.max_redemptions - used)
            except Exception:
                logger.debug("Could not count promo redemptions", exc_info=True)

    return JSONResponse({"status": "ok", "valid": True, "promo": _promo_info(promo, remaining)})


@router.post("/redeem")
async def redeem_promo(body: RedeemRequest) -> JSONResponse:
    promo = get_promo(body.code)
    if not promo:
        return JSONResponse({"status": "error", "detail": "That code isn't valid."}, status_code=404)

    # Discount codes are applied on the Stripe checkout page, not granted here.
    if promo.is_discount:
        return JSONResponse(
            {
                "status": "ok",
                "redeemed": False,
                "apply_at_checkout": True,
                "promo": _promo_info(promo, None),
                "detail": f"Enter code {promo.code} at checkout to get {promo.label}.",
            }
        )

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse(
            {"status": "error", "detail": "Promo codes are unavailable right now. Please try again later."},
            status_code=503,
        )

    try:
        from sqlalchemy import select
        from sqlalchemy.exc import IntegrityError
        from db_models import PromoRedemption, UserSignup

        async with _session_factory() as session:
            user = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == hash_token(body.access_token))
                )
            ).scalars().first()
            if not user:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)

            # Already redeemed by this user → idempotent success (no double grant).
            existing = (
                await session.execute(
                    select(PromoRedemption).where(
                        PromoRedemption.code == promo.code,
                        PromoRedemption.user_signup_id == user.id,
                    )
                )
            ).scalars().first()
            if existing:
                payload = _session_payload(user, access_token=body.access_token)
                payload["redeemed"] = True
                payload["already_redeemed"] = True
                payload["promo"] = _promo_info(promo, None)
                return JSONResponse(payload)

            used = await _redeemed_count(session, promo.code)
            if used >= promo.max_redemptions:
                return JSONResponse(
                    {"status": "error", "detail": f"Sorry — all {promo.max_redemptions} {promo.code} spots have been claimed."},
                    status_code=409,
                )

            now = datetime.now(timezone.utc)
            base_date = (
                user.subscription_expires_at
                if is_subscription_active(user.subscription_status, user.subscription_expires_at)
                else now
            )
            user.subscription_status = "active"
            user.subscription_tier = "pro"
            user.subscription_expires_at = base_date + timedelta(days=30 * promo.months)
            user.last_login_at = now
            session.add(
                PromoRedemption(
                    code=promo.code,
                    user_signup_id=user.id,
                    kind=promo.kind,
                    months=promo.months,
                    status="granted",
                    created_at=now,
                )
            )
            try:
                await session.commit()
            except IntegrityError:
                # Race: this user redeemed the same code concurrently. Treat as success.
                await session.rollback()
                await session.refresh(user)
                payload = _session_payload(user, access_token=body.access_token)
                payload["redeemed"] = True
                payload["already_redeemed"] = True
                payload["promo"] = _promo_info(promo, None)
                return JSONResponse(payload)
            await session.refresh(user)

        payload = _session_payload(user, access_token=body.access_token)
        payload["redeemed"] = True
        payload["promo"] = _promo_info(promo, None)
        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to redeem promo code", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not redeem code."}, status_code=500)
