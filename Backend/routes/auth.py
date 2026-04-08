"""LinkedIn OAuth 2.0 authentication endpoints.

Implements the Authorization Code flow to extract the user's LinkedIn profile URL
without requiring manual copy-paste. Only accesses public profile info (openid, profile).
"""

from __future__ import annotations

import logging
import os
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# In-memory state store for CSRF protection (use Redis in production at scale)
_pending_states: dict[str, bool] = {}


def _get_linkedin_config() -> dict[str, str]:
    """Read LinkedIn OAuth config from environment."""
    client_id = os.getenv("LINKEDIN_CLIENT_ID", "").strip()
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET", "").strip()
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
    backend_url = os.getenv("BACKEND_URL", frontend_origin).strip()
    redirect_uri = f"{backend_url}/auth/linkedin/callback"
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "frontend_origin": frontend_origin,
    }


@router.get("/auth/linkedin")
async def linkedin_auth_redirect():
    """Redirect user to LinkedIn OAuth authorization page."""
    config = _get_linkedin_config()
    if not config["client_id"]:
        raise HTTPException(
            status_code=503,
            detail={"message": "LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID.", "error_type": "server_error"},
        )

    state = secrets.token_urlsafe(32)
    _pending_states[state] = True

    params = {
        "response_type": "code",
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "scope": "openid profile email",
        "state": state,
    }
    auth_url = f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/auth/linkedin/callback")
async def linkedin_callback(code: str = "", state: str = "", error: str = ""):
    """Handle LinkedIn OAuth callback — exchange code for token, extract profile URL."""
    config = _get_linkedin_config()
    frontend_origin = config["frontend_origin"] or "/"

    # Handle OAuth errors (user denied, etc.)
    if error:
        logger.warning("LinkedIn OAuth error: %s", error)
        return RedirectResponse(url=f"{frontend_origin}?linkedin_error={error}")

    # Validate CSRF state
    if not state or state not in _pending_states:
        logger.warning("Invalid OAuth state parameter")
        return RedirectResponse(url=f"{frontend_origin}?linkedin_error=invalid_state")

    del _pending_states[state]

    if not code:
        return RedirectResponse(url=f"{frontend_origin}?linkedin_error=no_code")

    try:
        # Exchange authorization code for access token
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": config["redirect_uri"],
                    "client_id": config["client_id"],
                    "client_secret": config["client_secret"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if not token_resp.is_success:
                logger.error("Token exchange failed: %s", token_resp.text[:200])
                return RedirectResponse(url=f"{frontend_origin}?linkedin_error=token_failed")

            token_data = token_resp.json()
            access_token = token_data.get("access_token", "")

        if not access_token:
            return RedirectResponse(url=f"{frontend_origin}?linkedin_error=no_token")

        # Fetch user profile to get vanity name
        async with httpx.AsyncClient(timeout=10.0) as client:
            profile_resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile_resp.is_success:
                profile = profile_resp.json()
                # userinfo returns 'sub' (member ID) — construct profile URL
                # Try to get vanity name from /v2/me endpoint
                me_resp = await client.get(
                    "https://api.linkedin.com/v2/me",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if me_resp.is_success:
                    me_data = me_resp.json()
                    vanity_name = me_data.get("vanityName", "")
                    if vanity_name:
                        linkedin_url = f"https://www.linkedin.com/in/{vanity_name}"
                        logger.info("LinkedIn OAuth success: extracted URL for %s", vanity_name)
                        return RedirectResponse(
                            url=f"{frontend_origin}?linkedin_url={linkedin_url}"
                        )

                # Fallback: use the sub/id to construct a member URL
                sub = profile.get("sub", "")
                if sub:
                    linkedin_url = f"https://www.linkedin.com/in/{sub}"
                    return RedirectResponse(
                        url=f"{frontend_origin}?linkedin_url={linkedin_url}"
                    )

        logger.error("Could not extract LinkedIn profile URL from OAuth response")
        return RedirectResponse(url=f"{frontend_origin}?linkedin_error=no_profile")

    except Exception as exc:
        logger.exception("LinkedIn OAuth callback failed")
        return RedirectResponse(url=f"{frontend_origin}?linkedin_error=exception")
