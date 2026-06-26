"""Promotional code catalog and helpers.

Launch promo codes are a small, fixed set, so they live in code (not the DB).
Per-code redemption *counts* are tracked in the ``promo_redemptions`` table so
the limited-slot caps are enforced atomically; this module only defines the
benefits and the normalization/validation rules.

Two kinds of promo:
  * ``free_months`` — an app-side grant: activate Pro for N months, no charge.
  * ``percent_off`` — a discount applied to a real Stripe Checkout (a coupon);
    it only has an effect on the Stripe provider and a real payment.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Optional

FREE_MONTHS = "free_months"
PERCENT_OFF = "percent_off"


@dataclass(frozen=True)
class Promo:
    code: str
    kind: str
    max_redemptions: int
    months: int = 0            # for free_months grants
    percent_off: int = 0       # for percent_off discounts
    duration: str = "once"     # Stripe coupon duration: once | forever | repeating
    label: str = ""

    @property
    def is_free(self) -> bool:
        return self.kind == FREE_MONTHS

    @property
    def is_discount(self) -> bool:
        return self.kind == PERCENT_OFF


# The launch promo set. Each code is independently capped at 25 redemptions,
# one redemption per user (enforced in routes/promos.py + a DB unique index).
PROMO_CATALOG: Dict[str, Promo] = {
    "EARLYBIRD": Promo(
        code="EARLYBIRD",
        kind=FREE_MONTHS,
        max_redemptions=25,
        months=6,
        label="6 months free",
    ),
    "FIFA": Promo(
        code="FIFA",
        kind=FREE_MONTHS,
        max_redemptions=25,
        months=3,
        label="3 months free",
    ),
    "FIFA50": Promo(
        code="FIFA50",
        kind=PERCENT_OFF,
        max_redemptions=25,
        percent_off=50,
        duration="once",
        label="50% off your first payment",
    ),
}


def normalize_code(raw: Optional[str]) -> str:
    """Uppercase and strip all whitespace, so 'early bird' == 'EARLYBIRD'."""
    return re.sub(r"\s+", "", (raw or "")).upper()


def get_promo(raw: Optional[str]) -> Optional[Promo]:
    """Look up a promo by raw user input (case/whitespace insensitive)."""
    return PROMO_CATALOG.get(normalize_code(raw))
