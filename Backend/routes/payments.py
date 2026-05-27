"""Payment checkout endpoints with provider abstraction."""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.payments.base import PLAN_CATALOG, PaymentProvider
from services.payments.mock_provider import MockPaymentProvider
from services.payments.razorpay_provider import RazorpayPaymentProvider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])
_local_checkout_sessions: Dict[str, Dict[str, Any]] = {}


# Shared auth primitives (single implementation in services.auth_service).
from services.auth_service import (  # noqa: E402
    hash_token as _hash_token,
    is_subscription_active as _is_active,
)


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
        "subscription_active": _is_active(row.subscription_status, expires),
        "subscription_expires_at": expires.isoformat() if expires else None,
        "latest_assessment_result": row.assessment_snapshot if isinstance(row.assessment_snapshot, dict) else None,
        "latest_assessment_created_at": (
            row.assessment_snapshot.get("_saved_at")
            if isinstance(row.assessment_snapshot, dict)
            else None
        ),
    }


def _payment_provider() -> PaymentProvider:
    provider = (os.getenv("PAYMENT_PROVIDER") or "mock").strip().lower()
    if provider == "mock":
        return MockPaymentProvider()
    if provider == "razorpay":
        return RazorpayPaymentProvider()
    raise RuntimeError(f"Payment provider '{provider}' is not implemented.")


class CheckoutRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    plan_id: str = Field(..., min_length=3, max_length=50)


class ConfirmPaymentRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)
    session_id: str = Field(..., min_length=8, max_length=160)
    payment_method: Dict[str, Any] = Field(default_factory=dict)


@router.get("/plans")
async def list_plans() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "plans": [
                {
                    "id": plan.id,
                    "name": plan.name,
                    "amount_cents": plan.amount_cents,
                    "currency": plan.currency,
                    "months": plan.months,
                }
                for plan in PLAN_CATALOG.values()
            ],
        }
    )


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest) -> JSONResponse:
    plan = PLAN_CATALOG.get(body.plan_id)
    if not plan:
        return JSONResponse({"status": "error", "detail": "Unknown subscription plan."}, status_code=400)

    try:
        provider = _payment_provider()
    except RuntimeError as exc:
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=501)

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        checkout = await provider.create_checkout_session(user_id="local-dev", plan=plan)
        _local_checkout_sessions[checkout["session_id"]] = {
            "plan_id": plan.id,
            "months": plan.months,
            "amount_cents": plan.amount_cents,
            "currency": plan.currency,
        }
        return JSONResponse({"status": "ok", "persisted": False, "checkout": checkout})

    try:
        from sqlalchemy import select
        from db_models import PaymentEvent, PaymentSession, UserSignup

        async with _session_factory() as session:
            row = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
                )
            ).scalars().first()
            if not row:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)

            checkout = await provider.create_checkout_session(user_id=str(row.id), plan=plan)
            payment_session = PaymentSession(
                user_signup_id=row.id,
                provider=provider.provider_name,
                provider_session_id=checkout["session_id"],
                plan_id=plan.id,
                amount_cents=plan.amount_cents,
                currency=plan.currency,
                months=plan.months,
                status="created",
                event_metadata=checkout,
                created_at=datetime.now(timezone.utc),
            )
            session.add(payment_session)
            session.add(
                PaymentEvent(
                    user_signup_id=row.id,
                    provider=provider.provider_name,
                    event_type="checkout.created",
                    provider_session_id=checkout["session_id"],
                    payload=checkout,
                    created_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

        return JSONResponse({"status": "ok", "persisted": True, "checkout": checkout})
    except Exception:
        logger.warning("Failed to create checkout session", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not create checkout session."}, status_code=500)


@router.post("/confirm")
async def confirm_payment(body: ConfirmPaymentRequest) -> JSONResponse:
    try:
        provider = _payment_provider()
    except RuntimeError as exc:
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=501)

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        local_session = _local_checkout_sessions.get(body.session_id, {})
        expires = datetime.now(timezone.utc) + timedelta(days=30 * int(local_session.get("months", 1)))
        return JSONResponse(
            {
                "status": "ok",
                "persisted": False,
                "access_token": body.access_token,
                "subscription_status": "active",
                "subscription_active": True,
                "subscription_expires_at": expires.isoformat(),
                "payment": await provider.confirm_payment(session_id=body.session_id, payment_method=body.payment_method),
            }
        )

    try:
        from sqlalchemy import select
        from db_models import PaymentEvent, PaymentSession, UserSignup

        async with _session_factory() as session:
            user = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == _hash_token(body.access_token))
                )
            ).scalars().first()
            if not user:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)

            payment_session = (
                await session.execute(
                    select(PaymentSession).where(
                        PaymentSession.provider_session_id == body.session_id,
                        PaymentSession.user_signup_id == user.id,
                    )
                )
            ).scalars().first()
            if not payment_session:
                return JSONResponse({"status": "error", "detail": "Checkout session not found."}, status_code=404)
            if payment_session.status == "succeeded":
                return JSONResponse(_session_payload(user, access_token=body.access_token))

            payment = await provider.confirm_payment(session_id=body.session_id, payment_method=body.payment_method)
            if payment.get("status") != "succeeded":
                payment_session.status = "failed"
                session.add(
                    PaymentEvent(
                        user_signup_id=user.id,
                        provider=provider.provider_name,
                        event_type="payment.failed",
                        provider_session_id=body.session_id,
                        payload=payment,
                        created_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                return JSONResponse({"status": "error", "detail": "Payment was not completed."}, status_code=402)

            now = datetime.now(timezone.utc)
            base_date = user.subscription_expires_at if _is_active(user.subscription_status, user.subscription_expires_at) else now
            user.subscription_status = "active"
            user.subscription_expires_at = base_date + timedelta(days=30 * payment_session.months)
            user.last_login_at = now
            payment_session.status = "succeeded"
            payment_session.confirmed_at = now
            payment_session.event_metadata = {**(payment_session.event_metadata or {}), "payment": payment}
            session.add(
                PaymentEvent(
                    user_signup_id=user.id,
                    provider=provider.provider_name,
                    event_type="payment.succeeded",
                    provider_session_id=body.session_id,
                    payload=payment,
                    created_at=now,
                )
            )
            await session.commit()
            await session.refresh(user)

        payload = _session_payload(user, access_token=body.access_token)
        payload["payment"] = payment
        return JSONResponse(payload)
    except Exception:
        logger.warning("Failed to confirm payment", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not confirm payment."}, status_code=500)
