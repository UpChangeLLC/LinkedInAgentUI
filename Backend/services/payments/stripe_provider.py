"""Stripe payment provider — hosted Checkout (subscription mode) + webhooks.

Unlike Razorpay's synchronous verify-on-callback, Stripe activates via a
redirect to a hosted Checkout page and a server-to-server webhook. This provider
creates the Checkout Session (returning its ``checkout_url``) and offers a
reconciliation read of the session on the return URL; the authoritative
activation path is ``routes/stripe_webhooks.py``.

The ``stripe`` SDK is imported lazily through ``_load_stripe`` so the module
imports (and unit tests run) without the package or any API keys present.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from services.payments.base import Plan


def _load_stripe():  # pragma: no cover - thin import seam, patched in tests
    import stripe

    return stripe


def price_id_for(plan: Plan) -> Optional[str]:
    """Stripe Price id for a plan, from ``STRIPE_PRICE_<PLAN_ID>`` env."""
    value = os.getenv(f"STRIPE_PRICE_{plan.id.upper()}")
    return value.strip() if value else None


class StripePaymentProvider:
    provider_name = "stripe"

    def __init__(self) -> None:
        self.api_key = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
        if not self.api_key:
            raise RuntimeError("Stripe is not configured. Set STRIPE_SECRET_KEY.")
        self._success_url = (
            os.getenv("STRIPE_SUCCESS_URL")
            or f"{(os.getenv('FRONTEND_ORIGIN') or '').rstrip('/')}/?checkout=success"
        )
        self._cancel_url = (
            os.getenv("STRIPE_CANCEL_URL")
            or f"{(os.getenv('FRONTEND_ORIGIN') or '').rstrip('/')}/?checkout=cancel"
        )

    def _stripe(self):
        stripe = _load_stripe()
        stripe.api_key = self.api_key
        return stripe

    async def create_checkout_session(
        self,
        *,
        user_id: str,
        plan: Plan,
        customer_id: Optional[str] = None,
        customer_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        price_id = price_id_for(plan)
        if not price_id:
            raise RuntimeError(f"No Stripe price configured for plan '{plan.id}' (set STRIPE_PRICE_{plan.id.upper()}).")

        stripe = self._stripe()

        # Reuse the user's Stripe customer when we have one; otherwise create it
        # now so we can persist the id alongside the checkout session.
        if not customer_id:
            customer = stripe.Customer.create(
                email=customer_email or None,
                metadata={"user_id": user_id},
            )
            customer_id = customer.id

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=self._success_url,
            cancel_url=self._cancel_url,
            client_reference_id=user_id,
            metadata={"user_id": user_id, "plan_id": plan.id},
        )

        return {
            "provider": self.provider_name,
            "session_id": session.id,
            "checkout_url": session.url,
            "customer_id": customer_id,
            "status": "created",
            "amount_cents": plan.amount_cents,
            "currency": plan.currency,
            "metadata": {
                "user_id": user_id,
                "plan_id": plan.id,
                "price_id": price_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def create_portal_session(self, *, customer_id: str, return_url: str) -> Dict[str, Any]:
        """Create a Stripe Billing (Customer) Portal session for self-service
        management — update payment method, cancel, view invoices."""
        if not customer_id:
            raise ValueError("A Stripe customer id is required to open the billing portal.")
        stripe = self._stripe()
        session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
        return {"url": session.url}

    async def confirm_payment(self, *, session_id: str, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        """Return-URL reconciliation: read the Checkout Session from Stripe.

        Webhooks are the primary activation path; this lets a returning user be
        activated immediately if their webhook is delayed.
        """
        stripe = self._stripe()
        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except Exception:
            return {"provider": self.provider_name, "session_id": session_id, "status": "pending"}

        paid = getattr(session, "payment_status", None) == "paid" or getattr(session, "status", None) == "complete"
        return {
            "provider": self.provider_name,
            "session_id": session_id,
            "status": "succeeded" if paid else "pending",
            "stripe_subscription_id": getattr(session, "subscription", None),
            "customer_id": getattr(session, "customer", None),
        }
