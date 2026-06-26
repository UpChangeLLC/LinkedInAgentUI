"""Payment provider contracts and plan catalog."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    amount_cents: int
    currency: str
    months: int


def _price_cents(env_name: str, default_dollars: float) -> int:
    """Read a plan price (in whole/decimal currency units) from env -> cents.

    Single source of truth for prices is the VITE_PRICE_* vars (also read by the
    frontend for display); we convert dollars -> cents here. Falls back to the
    default if unset or unparseable. NOTE: with the Stripe Buy Button the *actual
    amount charged* is the Stripe Price on the button — this only drives the
    server-side checkout path and stored records.
    """
    raw = (os.getenv(env_name) or "").strip().lstrip("$").replace(",", "")
    try:
        return round(float(raw) * 100) if raw else round(default_dollars * 100)
    except ValueError:
        return round(default_dollars * 100)


_CURRENCY = (os.getenv("PLAN_CURRENCY") or "USD").strip().upper() or "USD"


PLAN_CATALOG: Dict[str, Plan] = {
    "monthly": Plan(id="monthly", name="Monthly", amount_cents=_price_cents("VITE_PRICE_MONTHLY", 9), currency=_CURRENCY, months=1),
    "quarterly": Plan(id="quarterly", name="Quarterly", amount_cents=_price_cents("VITE_PRICE_QUARTERLY", 24), currency=_CURRENCY, months=3),
    "annual": Plan(id="annual", name="Annual", amount_cents=_price_cents("VITE_PRICE_ANNUAL", 79), currency=_CURRENCY, months=12),
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
