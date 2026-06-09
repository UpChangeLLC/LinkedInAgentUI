"""Tests for the Stripe payment provider (mocked SDK — no network, no keys).

The provider imports the ``stripe`` SDK lazily via ``_load_stripe`` so these
tests inject a fake module and run anywhere, including CI without Stripe keys.
"""

from __future__ import annotations

import asyncio
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.payments.base import Plan  # noqa: E402

PLAN = Plan(id="monthly", name="Pro Monthly", amount_cents=900, currency="USD", months=1)


class _FakeSession:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    id = "cs_test_123"
    url = "https://checkout.stripe.com/c/pay/cs_test_123"


class _FakeStripe:
    """Minimal stand-in for the stripe SDK, recording calls."""

    def __init__(self):
        self.api_key = None
        self.created_customers = []
        self.created_sessions = []

        outer = self

        class Customer:
            @staticmethod
            def create(**kwargs):
                outer.created_customers.append(kwargs)
                return types.SimpleNamespace(id="cus_new_1", **kwargs)

        class _SessionNS:
            @staticmethod
            def create(**kwargs):
                outer.created_sessions.append(kwargs)
                return types.SimpleNamespace(id="cs_test_123", url="https://checkout.stripe.com/c/pay/cs_test_123")

        class _PortalSessionNS:
            @staticmethod
            def create(**kwargs):
                outer.created_portal_sessions.append(kwargs)
                return types.SimpleNamespace(url="https://billing.stripe.com/p/session_abc")

        self.Customer = Customer
        self.checkout = types.SimpleNamespace(Session=_SessionNS)
        self.billing_portal = types.SimpleNamespace(Session=_PortalSessionNS)
        self.created_portal_sessions = []


@pytest.fixture()
def fake_stripe(monkeypatch):
    fake = _FakeStripe()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("STRIPE_PRICE_MONTHLY", "price_monthly_123")
    monkeypatch.setenv("STRIPE_SUCCESS_URL", "https://app.upchange.ai/?checkout=success")
    monkeypatch.setenv("STRIPE_CANCEL_URL", "https://app.upchange.ai/?checkout=cancel")
    import services.payments.stripe_provider as sp

    monkeypatch.setattr(sp, "_load_stripe", lambda: fake)
    return fake


def test_checkout_returns_url_and_maps_price(fake_stripe):
    from services.payments.stripe_provider import StripePaymentProvider

    provider = StripePaymentProvider()
    result = asyncio.run(provider.create_checkout_session(user_id="u1", plan=PLAN, customer_email="u1@x.com"))

    assert result["checkout_url"] == "https://checkout.stripe.com/c/pay/cs_test_123"
    assert result["session_id"] == "cs_test_123"
    assert result["provider"] == "stripe"
    # subscription mode using the mapped Price id, bound to the user.
    session_kwargs = fake_stripe.created_sessions[0]
    assert session_kwargs["mode"] == "subscription"
    assert session_kwargs["line_items"][0]["price"] == "price_monthly_123"
    assert session_kwargs["client_reference_id"] == "u1"


def test_creates_customer_when_none_provided(fake_stripe):
    from services.payments.stripe_provider import StripePaymentProvider

    provider = StripePaymentProvider()
    result = asyncio.run(provider.create_checkout_session(user_id="u1", plan=PLAN, customer_email="u1@x.com"))

    assert len(fake_stripe.created_customers) == 1
    assert result["customer_id"] == "cus_new_1"


def test_reuses_existing_customer(fake_stripe):
    from services.payments.stripe_provider import StripePaymentProvider

    provider = StripePaymentProvider()
    result = asyncio.run(
        provider.create_checkout_session(user_id="u1", plan=PLAN, customer_id="cus_existing", customer_email="u1@x.com")
    )

    assert fake_stripe.created_customers == []  # did not create a new customer
    assert result["customer_id"] == "cus_existing"
    assert fake_stripe.created_sessions[0]["customer"] == "cus_existing"


def test_missing_price_for_plan_raises(fake_stripe, monkeypatch):
    from services.payments.stripe_provider import StripePaymentProvider

    monkeypatch.delenv("STRIPE_PRICE_MONTHLY", raising=False)
    provider = StripePaymentProvider()
    with pytest.raises(RuntimeError, match="price"):
        asyncio.run(provider.create_checkout_session(user_id="u1", plan=PLAN, customer_email="u1@x.com"))


def test_missing_secret_key_raises(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    from services.payments.stripe_provider import StripePaymentProvider

    with pytest.raises(RuntimeError, match="STRIPE_SECRET_KEY"):
        StripePaymentProvider()


def test_portal_session_returns_url(fake_stripe):
    from services.payments.stripe_provider import StripePaymentProvider

    provider = StripePaymentProvider()
    result = asyncio.run(
        provider.create_portal_session(customer_id="cus_1", return_url="https://app.upchange.ai/")
    )
    assert result["url"] == "https://billing.stripe.com/p/session_abc"
    kwargs = fake_stripe.created_portal_sessions[0]
    assert kwargs["customer"] == "cus_1"
    assert kwargs["return_url"] == "https://app.upchange.ai/"


def test_portal_session_requires_customer(fake_stripe):
    from services.payments.stripe_provider import StripePaymentProvider

    provider = StripePaymentProvider()
    with pytest.raises(ValueError, match="customer"):
        asyncio.run(provider.create_portal_session(customer_id="", return_url="https://app.upchange.ai/"))
