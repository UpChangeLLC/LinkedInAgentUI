"""The CSP must permit Stripe so the embedded Buy Button can load and render."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_csp_allows_stripe_buy_button(client):
    resp = await client.get("/health")
    csp = resp.headers.get("content-security-policy", "")
    assert csp, "CSP header should be present"
    # Script (buy-button.js) + iframe (the button/checkout) + API network calls.
    assert "https://js.stripe.com" in csp
    assert "frame-src" in csp and "https://js.stripe.com" in csp
    assert "https://api.stripe.com" in csp


@pytest.mark.asyncio
async def test_csp_still_restricts_default_src(client):
    """Stripe allowances shouldn't loosen the baseline (default-src stays self)."""
    resp = await client.get("/health")
    csp = resp.headers.get("content-security-policy", "")
    assert "default-src 'self'" in csp
