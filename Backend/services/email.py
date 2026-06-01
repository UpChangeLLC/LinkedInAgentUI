"""Provider-agnostic transactional email sender (Workstream D).

The vendor (Postmark vs Resend) is an open decision (doc 03 §12), so this ships
with a no-op default and REST implementations for Postmark/Resend that activate
only when ``EMAIL_PROVIDER`` + the matching token are configured. No SDK
dependency — both vendors expose a simple JSON REST API.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

FROM_ADDRESS = os.getenv("EMAIL_FROM", "hello@upchange.ai")


def provider() -> str:
    return os.getenv("EMAIL_PROVIDER", "none").strip().lower()


async def send_email(template: str, to: str, model: Dict[str, Any], message_stream: str = "outbound") -> bool:
    """Send one templated email. Returns True if dispatched, False if no-op/failed.

    Never raises — the queue dispatcher treats a False as a soft failure.
    """
    prov = provider()
    if prov == "none" or not to:
        logger.info("email_noop template=%s stream=%s to=%s", template, message_stream, to)
        return False
    try:
        if prov == "postmark":
            return await _send_postmark(template, to, model, message_stream)
        if prov == "resend":
            return await _send_resend(template, to, model, message_stream)
    except Exception:
        logger.warning("email send failed (provider=%s, template=%s)", prov, template, exc_info=True)
        return False
    logger.warning("unknown EMAIL_PROVIDER=%s", prov)
    return False


async def _send_postmark(template: str, to: str, model: Dict[str, Any], stream: str) -> bool:
    token = os.getenv("POSTMARK_SERVER_TOKEN", "").strip()
    if not token:
        logger.info("postmark token missing — skipping send")
        return False
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.postmarkapp.com/email/withTemplate",
            headers={"X-Postmark-Server-Token": token, "Accept": "application/json"},
            json={
                "From": FROM_ADDRESS,
                "To": to,
                "TemplateAlias": template,
                "TemplateModel": model,
                "MessageStream": stream,
            },
        )
        resp.raise_for_status()
    return True


async def _send_resend(template: str, to: str, model: Dict[str, Any], stream: str) -> bool:
    token = os.getenv("RESEND_API_KEY", "").strip()
    if not token:
        logger.info("resend key missing — skipping send")
        return False
    # Resend has no server-side template aliases; the caller's template name maps
    # to a subject and the model renders client-side. Minimal payload here.
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "from": FROM_ADDRESS,
                "to": [to],
                "subject": model.get("subject", "Upchange"),
                "text": model.get("text", ""),
                "tags": [{"name": "template", "value": template}, {"name": "stream", "value": stream}],
            },
        )
        resp.raise_for_status()
    return True
