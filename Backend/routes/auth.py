"""LinkedIn OAuth 2.0 authentication endpoints.

Implements the Authorization Code flow to extract the user's LinkedIn profile URL
without requiring manual copy-paste. Only accesses public profile info (openid, profile).
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any, Dict
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from cache import cache_delete, cache_get, cache_get_json, cache_set, cache_set_json

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# In-memory fallback state store for CSRF protection when Redis is unavailable
_pending_states: dict[str, bool] = {}
_pending_oauth_profiles: dict[str, Dict[str, Any]] = {}

_OAUTH_STATE_TTL = 600  # 10 minutes


def _oauth_error_redirect(redirect_base: str, code: str) -> RedirectResponse:
    """Redirect to SPA with a deterministic LinkedIn OAuth error code."""
    return RedirectResponse(url=f"{redirect_base}?linkedin_error={quote(code, safe='')}")


async def _store_oauth_profile_payload(profile: Dict[str, Any]) -> str:
    """Store OAuth profile payload short-term and return retrieval token."""
    token = secrets.token_urlsafe(24)
    redis_key = f"oauth_profile:{token}"
    stored = await cache_set_json(redis_key, profile, ttl_seconds=_OAUTH_STATE_TTL)
    if not stored:
        _pending_oauth_profiles[token] = profile
    return token


def _get_linkedin_config(request: Request | None = None) -> dict[str, str]:
    """Read LinkedIn OAuth config from environment.

    When BACKEND_URL and FRONTEND_ORIGIN are not set (e.g. local dev), infers
    the base URL from the incoming request's host header so the redirect URI
    always points back to the correct server.

    ``callback_redirect_base`` is always set to ``backend_url`` because the
    React SPA is served from the same origin as the FastAPI server.
    ``frontend_origin`` retains its CORS-only meaning and is NOT used for
    post-OAuth redirects.
    """
    client_id = os.getenv("LINKEDIN_CLIENT_ID", "").strip()
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET", "").strip()
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()
    backend_url = os.getenv("BACKEND_URL", "").strip()

    # Infer backend URL from request when env var is not set
    if not backend_url:
        if request is not None:
            scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
            host = request.headers.get("host", request.url.netloc)
            backend_url = f"{scheme}://{host}"
        elif frontend_origin:
            # Last resort fallback (no request context)
            backend_url = frontend_origin

    # Infer frontend origin from request when not set (for CORS context only)
    if not frontend_origin:
        if request is not None:
            origin = request.headers.get("origin", "")
            frontend_origin = origin or backend_url
        else:
            frontend_origin = backend_url

    redirect_uri = f"{backend_url}/auth/linkedin/callback"
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "frontend_origin": frontend_origin,
        # Always redirect the browser back to the backend/SPA origin after OAuth,
        # regardless of what FRONTEND_ORIGIN is set to (could be a different domain).
        "callback_redirect_base": backend_url,
    }


@router.get("/auth/linkedin")
async def linkedin_auth_redirect(request: Request):
    """Redirect user to LinkedIn OAuth authorization page."""
    config = _get_linkedin_config(request)
    if not config["client_id"]:
        raise HTTPException(
            status_code=503,
            detail={"message": "LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID.", "error_type": "server_error"},
        )

    state = secrets.token_urlsafe(32)
    redis_key = f"oauth_state:{state}"
    # Try Redis first (survives multi-instance deployments); fall back to in-memory
    stored = await cache_set(redis_key, "1", ttl_seconds=_OAUTH_STATE_TTL)
    if not stored:
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
async def linkedin_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """Handle LinkedIn OAuth callback — exchange code for token, extract profile URL."""
    config = _get_linkedin_config(request)
    # Use backend/SPA origin for post-OAuth redirects, NOT frontend_origin.
    # frontend_origin may be a separate production domain (CORS only); the SPA
    # is always served from the same host as this backend server.
    redirect_base = config["callback_redirect_base"] or "/"

    # Handle OAuth errors (user denied, etc.)
    if error:
        logger.warning("LinkedIn OAuth error: %s", error)
        return _oauth_error_redirect(redirect_base, error)

    # Validate CSRF state — check Redis first, then in-memory fallback
    if not state:
        logger.warning("Missing OAuth state parameter")
        return _oauth_error_redirect(redirect_base, "invalid_state")

    redis_key = f"oauth_state:{state}"
    redis_val = await cache_get(redis_key)
    if redis_val is not None:
        # Found in Redis — consume it
        await cache_delete(redis_key)
    elif state in _pending_states:
        # Fallback: found in memory (Redis unavailable)
        del _pending_states[state]
    else:
        logger.warning("Invalid OAuth state parameter: %s", state[:8])
        return _oauth_error_redirect(redirect_base, "invalid_state")

    if not code:
        return _oauth_error_redirect(redirect_base, "no_code")

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
                logger.error("Token exchange failed: status=%s body=%s", token_resp.status_code, token_resp.text[:200])
                return _oauth_error_redirect(redirect_base, "token_failed")

            token_data = token_resp.json()
            access_token = token_data.get("access_token", "")

        if not access_token:
            return _oauth_error_redirect(redirect_base, "no_token")

        # Fetch user profile to get vanity name/public URL
        async with httpx.AsyncClient(timeout=10.0) as client:
            profile_resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile_resp.is_success:
                profile = profile_resp.json()
                oauth_profile_payload: Dict[str, Any] = {
                    "provider": "linkedin",
                    "source": "oauth_userinfo",
                    "userinfo": profile,
                }
                # Some OpenID configs may return a direct profile URL.
                profile_url = (
                    str(profile.get("profile") or "").strip()
                    or str(profile.get("profile_url") or "").strip()
                )
                if profile_url.startswith("http"):
                    logger.info("LinkedIn OAuth success: extracted profile URL from userinfo")
                    token = await _store_oauth_profile_payload(oauth_profile_payload)
                    return RedirectResponse(
                        url=(
                            f"{redirect_base}?linkedin_url={quote(profile_url, safe='')}"
                            f"&oauth_profile_token={quote(token, safe='')}&start_analysis=1"
                        )
                    )

                # Try to get vanity name from /v2/me endpoint.
                me_resp = await client.get(
                    "https://api.linkedin.com/v2/me?projection=(id,vanityName)",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if me_resp.is_success:
                    me_data = me_resp.json()
                    oauth_profile_payload["me"] = me_data
                    vanity_name = me_data.get("vanityName", "")
                    if vanity_name:
                        linkedin_url = f"https://www.linkedin.com/in/{vanity_name}"
                        logger.info("LinkedIn OAuth success: extracted URL for %s", vanity_name)
                        token = await _store_oauth_profile_payload(oauth_profile_payload)
                        return RedirectResponse(
                            url=(
                                f"{redirect_base}?linkedin_url={quote(linkedin_url, safe='')}"
                                f"&oauth_profile_token={quote(token, safe='')}&start_analysis=1"
                            )
                        )
                else:
                    logger.warning("LinkedIn /v2/me lookup failed with status=%s", me_resp.status_code)

                # Fallback path: continue flow with OAuth profile payload only.
                token = await _store_oauth_profile_payload(oauth_profile_payload)
                logger.info("LinkedIn OAuth success without public URL; using oauth_profile_token fallback")
                return RedirectResponse(
                    url=f"{redirect_base}?oauth_profile_token={quote(token, safe='')}&start_analysis=1"
                )

        logger.error("Could not extract LinkedIn profile URL from OAuth response")
        return _oauth_error_redirect(redirect_base, "no_profile")

    except Exception as exc:
        logger.exception("LinkedIn OAuth callback failed")
        return _oauth_error_redirect(redirect_base, "exception")


@router.get("/auth/linkedin/profile/{token}")
async def linkedin_oauth_profile(token: str):
    """Read and consume short-lived OAuth profile payload by token."""
    if not token:
        raise HTTPException(status_code=400, detail={"message": "Missing token", "error_type": "invalid_token"})

    redis_key = f"oauth_profile:{token}"
    payload = await cache_get_json(redis_key)
    if payload is not None:
        await cache_delete(redis_key)
    else:
        payload = _pending_oauth_profiles.pop(token, None)

    if not payload:
        raise HTTPException(status_code=404, detail={"message": "OAuth profile token not found", "error_type": "invalid_token"})

    return {"status": "ok", "profile": payload}
