"""Stripe webhook endpoint — signature trust boundary tests.

These cover the security-critical branches that run *before* the DB import
(missing secret, invalid signature). The DB-dependent idempotency + state
transition is covered by the pure logic in test_stripe_events.py and the
deployed integration env. Handlers are called directly with a fake Request so
no full-app (or sqlalchemy/docx) import is required.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import routes.stripe_webhooks as wh  # noqa: E402


class _FakeRequest:
    def __init__(self, body: bytes = b"{}", headers: dict | None = None):
        self._body = body
        self.headers = headers or {}

    async def body(self) -> bytes:
        return self._body


def _body(resp):
    return json.loads(resp.body)


def test_missing_webhook_secret_is_500(monkeypatch):
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    resp = asyncio.run(wh.stripe_webhook(_FakeRequest()))
    assert resp.status_code == 500
    assert _body(resp)["status"] == "error"


def test_invalid_signature_is_400(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")

    def _raise(payload, sig, secret):
        raise ValueError("bad signature")

    monkeypatch.setattr(wh, "_verify_event", _raise)
    resp = asyncio.run(wh.stripe_webhook(_FakeRequest(headers={"Stripe-Signature": "bad"})))
    assert resp.status_code == 400
    assert _body(resp)["status"] == "error"


def test_user_lookup_key_prefers_client_reference_id():
    # Pure helper: locating the affected user from the event object.
    uid, cust = wh._user_lookup_key(
        "checkout.session.completed",
        {"client_reference_id": "u1", "customer": "cus_1"},
    )
    assert uid == "u1"
    assert cust == "cus_1"

    uid2, _ = wh._user_lookup_key(
        "customer.subscription.updated",
        {"metadata": {"user_id": "u2"}, "customer": "cus_2"},
    )
    assert uid2 == "u2"
