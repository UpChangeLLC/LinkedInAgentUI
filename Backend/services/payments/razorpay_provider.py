"""Razorpay payment provider.

This provider creates Razorpay Orders and verifies the Checkout success
signature before the app marks a subscription active.
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

from services.payments.base import Plan


class RazorpayPaymentProvider:
    provider_name = "razorpay"
    _api_base = "https://api.razorpay.com/v1"

    def __init__(self) -> None:
        self.key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
        self.key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
        if not self.key_id or not self.key_secret:
            raise RuntimeError("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")

    async def create_checkout_session(self, *, user_id: str, plan: Plan) -> Dict[str, Any]:
        receipt = f"airs_{user_id.replace('-', '')[:18]}_{plan.id}"[:40]
        payload = {
            "amount": plan.amount_cents,
            "currency": plan.currency,
            "receipt": receipt,
            "notes": {
                "user_id": user_id,
                "plan_id": plan.id,
                "plan_name": plan.name,
                "months": str(plan.months),
            },
        }

        async with httpx.AsyncClient(timeout=20.0, auth=(self.key_id, self.key_secret)) as client:
            response = await client.post(f"{self._api_base}/orders", json=payload)
            response.raise_for_status()
            order = response.json()

        return {
            "provider": self.provider_name,
            "session_id": order["id"],
            "checkout_url": None,
            "status": order.get("status", "created"),
            "amount_cents": order.get("amount", plan.amount_cents),
            "currency": order.get("currency", plan.currency),
            "metadata": {
                "key_id": self.key_id,
                "order_id": order["id"],
                "receipt": order.get("receipt", receipt),
                "plan_id": plan.id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def confirm_payment(self, *, session_id: str, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        payment_id = str(payment_method.get("razorpay_payment_id") or payment_method.get("payment_id") or "").strip()
        signature = str(payment_method.get("razorpay_signature") or payment_method.get("signature") or "").strip()
        order_id = str(payment_method.get("razorpay_order_id") or session_id).strip()

        if not payment_id or not signature or not order_id:
            return {
                "provider": self.provider_name,
                "session_id": session_id,
                "status": "failed",
                "detail": "Missing Razorpay payment id, order id, or signature.",
            }

        signed_payload = f"{order_id}|{payment_id}".encode("utf-8")
        expected_signature = hmac.new(
            self.key_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, signature):
            return {
                "provider": self.provider_name,
                "session_id": session_id,
                "payment_id": payment_id,
                "status": "failed",
                "detail": "Invalid Razorpay payment signature.",
            }

        payment: Dict[str, Any] = {}
        try:
            async with httpx.AsyncClient(timeout=20.0, auth=(self.key_id, self.key_secret)) as client:
                response = await client.get(f"{self._api_base}/payments/{payment_id}")
                response.raise_for_status()
                payment = response.json()
        except Exception:
            # Signature verification is the critical trust boundary. Payment fetch
            # enriches audit data but should not fail a valid callback by itself.
            payment = {}

        return {
            "provider": self.provider_name,
            "session_id": session_id,
            "payment_id": payment_id,
            "status": "succeeded",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_method": {
                "method": payment.get("method"),
                "bank": payment.get("bank"),
                "wallet": payment.get("wallet"),
                "card_id": payment.get("card_id"),
            },
            "raw_payment": payment,
        }
