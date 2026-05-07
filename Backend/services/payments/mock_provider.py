"""Mock payment provider with the same contract as a real checkout provider."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict

from services.payments.base import Plan


class MockPaymentProvider:
    provider_name = "mock"

    async def create_checkout_session(self, *, user_id: str, plan: Plan) -> Dict[str, Any]:
        session_id = f"mock_cs_{secrets.token_urlsafe(18)}"
        return {
            "provider": self.provider_name,
            "session_id": session_id,
            "checkout_url": None,
            "status": "created",
            "amount_cents": plan.amount_cents,
            "currency": plan.currency,
            "metadata": {
                "user_id": user_id,
                "plan_id": plan.id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def confirm_payment(self, *, session_id: str, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        last4 = str(payment_method.get("card_number", ""))[-4:] if payment_method else ""
        return {
            "provider": self.provider_name,
            "session_id": session_id,
            "payment_id": f"mock_pi_{secrets.token_urlsafe(16)}",
            "status": "succeeded",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_method": {
                "brand": "mock-card",
                "last4": last4 or "4242",
            },
        }
