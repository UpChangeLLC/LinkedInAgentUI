"""Payment provider contracts and plan catalog."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    amount_cents: int
    currency: str
    months: int


PLAN_CATALOG: Dict[str, Plan] = {
    "monthly": Plan(id="monthly", name="Monthly", amount_cents=900, currency="USD", months=1),
    "quarterly": Plan(id="quarterly", name="Quarterly", amount_cents=2400, currency="USD", months=3),
    "annual": Plan(id="annual", name="Annual", amount_cents=7900, currency="USD", months=12),
}


class PaymentProvider(Protocol):
    provider_name: str

    async def create_checkout_session(
        self,
        *,
        user_id: str,
        plan: Plan,
        customer_id: Optional[str] = None,
        customer_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a provider checkout session.

        ``customer_id``/``customer_email`` let providers that model customers
        (e.g. Stripe) reuse or create one; others may ignore them.
        """

    async def confirm_payment(self, *, session_id: str, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        """Confirm provider payment and return normalized status."""
