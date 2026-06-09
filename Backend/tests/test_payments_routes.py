"""Payment route tests — call the handlers directly (no full-app import).

Runs in the no-DB path (conftest sets DATABASE_URL=""), which exercises the
provider + validation branches without a database. DB-dependent idempotency is
covered by the deployed integration env.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routes.payments import (  # noqa: E402
    CheckoutRequest,
    create_checkout,
    list_plans,
)

_TOKEN = "a" * 24  # satisfies min_length


def _body(resp):
    return json.loads(resp.body)


def test_list_plans_returns_catalog():
    resp = asyncio.run(list_plans())
    data = _body(resp)
    assert data["status"] == "ok"
    assert any(p["id"] == "monthly" for p in data["plans"])


def test_checkout_unknown_plan_is_400():
    # Plan validation happens before any DB import, so this runs everywhere.
    resp = asyncio.run(create_checkout(CheckoutRequest(access_token=_TOKEN, plan_id="does-not-exist")))
    assert resp.status_code == 400
    assert _body(resp)["status"] == "error"


# Note: the valid-checkout / confirm paths import `db` (sqlalchemy) and are
# exercised by the deployed integration env, not this unit suite.
