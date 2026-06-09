"""Stripe webhook endpoint — the authoritative subscription activation path.

Signature verification with ``STRIPE_WEBHOOK_SECRET`` is the trust boundary
(analogous to Razorpay's HMAC check). Processing is idempotent via the unique
``payment_events.stripe_event_id`` column, so Stripe's at-least-once delivery
and replays never double-apply. The state transition itself is the pure,
unit-tested ``services.stripe_events.apply_subscription_event``.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.auth_service import hash_token
from services.payments.stripe_provider import StripePaymentProvider, _load_stripe
from services.stripe_events import apply_subscription_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments/stripe", tags=["payments"])


class PortalRequest(BaseModel):
    access_token: str = Field(..., min_length=16, max_length=256)


def _verify_event(payload: bytes, sig_header: str, secret: str) -> Any:
    """Verify the Stripe signature and return the parsed event (raises on bad sig)."""
    stripe = _load_stripe()
    return stripe.Webhook.construct_event(payload, sig_header, secret)


def _user_lookup_key(event_type: str, obj: dict) -> tuple[Optional[str], Optional[str]]:
    """Return (user_id, customer_id) to locate the affected user."""
    user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
    customer_id = obj.get("customer")
    return user_id, customer_id


@router.post("/portal")
async def create_billing_portal(body: PortalRequest) -> JSONResponse:
    """Return a Stripe Customer Portal URL for the signed-in user to manage or
    cancel their subscription. Requires an existing Stripe customer."""
    import os

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        return JSONResponse({"status": "error", "detail": "Billing portal unavailable."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import UserSignup

        async with _session_factory() as session:
            user = (
                await session.execute(
                    select(UserSignup).where(UserSignup.access_token_hash == hash_token(body.access_token))
                )
            ).scalars().first()
            if not user:
                return JSONResponse({"status": "error", "detail": "Session not found."}, status_code=404)
            customer_id = getattr(user, "stripe_customer_id", None)

        if not customer_id:
            return JSONResponse(
                {"status": "error", "detail": "No active billing account to manage."}, status_code=400
            )

        return_url = (os.getenv("STRIPE_PORTAL_RETURN_URL") or os.getenv("FRONTEND_ORIGIN") or "").rstrip("/") + "/"
        provider = StripePaymentProvider()
        result = await provider.create_portal_session(customer_id=customer_id, return_url=return_url)
        return JSONResponse({"status": "ok", "url": result["url"]})
    except RuntimeError as exc:  # Stripe not configured
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=501)
    except Exception:
        logger.warning("Failed to create billing portal session", exc_info=True)
        return JSONResponse({"status": "error", "detail": "Could not open billing portal."}, status_code=500)


@router.post("/webhook")
async def stripe_webhook(request: Request) -> JSONResponse:
    secret = (os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip()
    if not secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured")
        return JSONResponse({"status": "error", "detail": "Webhook not configured."}, status_code=500)

    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = _verify_event(payload, sig_header, secret)
    except Exception:
        logger.warning("Invalid Stripe webhook signature")
        return JSONResponse({"status": "error", "detail": "Invalid signature."}, status_code=400)

    event_id = event.get("id")
    event_type = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}

    from db import _session_factory, db_available

    if not db_available() or not _session_factory:
        # Can't dedupe or persist without the DB — ask Stripe to retry later.
        return JSONResponse({"status": "retry", "detail": "Datastore unavailable."}, status_code=503)

    try:
        from sqlalchemy import select
        from db_models import PaymentEvent, UserSignup

        async with _session_factory() as session:
            # Idempotency: skip events we've already recorded.
            already = (
                await session.execute(
                    select(PaymentEvent).where(PaymentEvent.stripe_event_id == event_id)
                )
            ).scalars().first()
            if already:
                return JSONResponse({"status": "ok", "deduped": True})

            user_id, customer_id = _user_lookup_key(event_type, obj)
            user = None
            if user_id:
                user = (
                    await session.execute(select(UserSignup).where(UserSignup.id == user_id))
                ).scalars().first()
            if user is None and customer_id:
                user = (
                    await session.execute(
                        select(UserSignup).where(UserSignup.stripe_customer_id == customer_id)
                    )
                ).scalars().first()

            changed = False
            if user is not None:
                # Link the Stripe customer on first contact.
                if customer_id and not user.stripe_customer_id:
                    user.stripe_customer_id = customer_id
                changed = apply_subscription_event(user, event_type, obj)
                if changed:
                    user.last_login_at = datetime.now(timezone.utc)

            session.add(
                PaymentEvent(
                    user_signup_id=user.id if user is not None else None,
                    provider="stripe",
                    event_type=event_type,
                    provider_session_id=obj.get("id"),
                    stripe_event_id=event_id,
                    payload=obj if isinstance(obj, dict) else None,
                    created_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

        return JSONResponse({"status": "ok", "applied": changed})
    except Exception:
        logger.warning("Failed to process Stripe webhook", exc_info=True)
        # Return 500 so Stripe retries rather than dropping the event.
        return JSONResponse({"status": "error", "detail": "Processing failed."}, status_code=500)
