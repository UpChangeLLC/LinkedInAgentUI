"""Promo code tests — service rules + redeem handler branches.

The free-code grant path needs a DB session, so we drive the handler with a
small fake async session (the project's convention is to keep these unit tests
network/DB-free; see test_payments_routes.py).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routes.promos import RedeemRequest, redeem_promo, validate_promo  # noqa: E402
from services.promos import get_promo, normalize_code  # noqa: E402

_TOKEN = "a" * 24


def _body(resp):
    return json.loads(resp.body)


# --------------------------- service rules ---------------------------

def test_normalize_code_strips_space_and_uppercases():
    assert normalize_code(" early bird ") == "EARLYBIRD"
    assert normalize_code("fifa50") == "FIFA50"


def test_catalog_benefits():
    assert get_promo("EARLYBIRD").months == 6
    assert get_promo("FIFA").months == 3
    fifa50 = get_promo("FIFA50")
    assert fifa50.percent_off == 50 and fifa50.is_discount
    assert get_promo("nope") is None


# --------------------------- validate ---------------------------

def test_validate_unknown_is_404():
    resp = asyncio.run(validate_promo("bogus"))
    assert resp.status_code == 404
    assert _body(resp)["valid"] is False


def test_validate_discount_code_ok():
    resp = asyncio.run(validate_promo("fifa50"))
    data = _body(resp)
    assert data["valid"] is True
    assert data["promo"]["apply_at_checkout"] is True


# --------------------------- redeem ---------------------------

def test_redeem_unknown_is_404():
    resp = asyncio.run(redeem_promo(RedeemRequest(access_token=_TOKEN, code="bogus")))
    assert resp.status_code == 404


def test_redeem_discount_directs_to_checkout():
    resp = asyncio.run(redeem_promo(RedeemRequest(access_token=_TOKEN, code="FIFA50")))
    data = _body(resp)
    assert data["status"] == "ok"
    assert data["redeemed"] is False
    assert data["apply_at_checkout"] is True


def test_redeem_free_code_without_db_is_503():
    # No DB configured (conftest sets DATABASE_URL="") -> graceful unavailable.
    with patch("db._session_factory", None):
        resp = asyncio.run(redeem_promo(RedeemRequest(access_token=_TOKEN, code="EARLYBIRD")))
    assert resp.status_code == 503


# ----- fake async session for the DB grant path -----

class _FakeResult:
    def __init__(self, *, first=None, scalar=None):
        self._first = first
        self._scalar = scalar

    def scalars(self):
        return self

    def first(self):
        return self._first

    def scalar(self):
        return self._scalar


class _FakeSession:
    def __init__(self, results):
        self._results = list(results)
        self.added = []
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, _stmt):
        return self._results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, _obj):
        return None


def _user():
    return SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        email="u@example.com",
        full_name="U",
        subscription_status="trial",
        subscription_tier="free",
        subscription_expires_at=None,
        last_login_at=None,
        access_token_hash="x",
    )


def _run_redeem(results):
    session = _FakeSession(results)
    with patch("db._session_factory", lambda: session):
        resp = asyncio.run(redeem_promo(RedeemRequest(access_token=_TOKEN, code="EARLYBIRD")))
    return session, resp


def test_redeem_free_code_grants_pro_for_six_months():
    user = _user()
    # execute order: user lookup, existing-redemption lookup, count
    session, resp = _run_redeem([
        _FakeResult(first=user),
        _FakeResult(first=None),
        _FakeResult(scalar=0),
    ])
    data = _body(resp)
    assert data["status"] == "ok" and data["redeemed"] is True
    assert user.subscription_status == "active"
    assert user.subscription_tier == "pro"
    # 6 months ~= 180 days from now
    delta = user.subscription_expires_at - datetime.now(timezone.utc)
    assert 175 <= delta.days <= 181
    assert session.committed is True
    assert len(session.added) == 1  # the PromoRedemption row


def test_redeem_free_code_cap_exhausted_is_409():
    user = _user()
    session, resp = _run_redeem([
        _FakeResult(first=user),
        _FakeResult(first=None),
        _FakeResult(scalar=25),
    ])
    assert resp.status_code == 409
    assert user.subscription_status == "trial"  # untouched
    assert session.added == []


def test_redeem_free_code_already_redeemed_is_idempotent():
    user = _user()
    existing = SimpleNamespace(code="EARLYBIRD", user_signup_id=user.id)
    session, resp = _run_redeem([
        _FakeResult(first=user),
        _FakeResult(first=existing),
    ])
    data = _body(resp)
    assert data["redeemed"] is True
    assert data["already_redeemed"] is True
    assert session.added == []  # no second grant


def test_redeem_free_code_user_not_found_is_404():
    session, resp = _run_redeem([_FakeResult(first=None)])
    assert resp.status_code == 404
