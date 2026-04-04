"""GitHub profile fetching service for multi-signal input (F2)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
GITHUB_API_TIMEOUT = 15.0


def _extract_github_username(github_url: str) -> str:
    """Extract username from a GitHub profile URL.

    Accepts formats like:
      - https://github.com/username
      - github.com/username
      - https://www.github.com/username/
    """
    raw = (github_url or "").strip()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlparse(candidate)
    except Exception:
        return ""
    host = (parsed.netloc or "").lower().lstrip("www.")
    if host != "github.com":
        return ""
    parts = [p for p in (parsed.path or "").split("/") if p]
    if not parts:
        return ""
    return parts[0]


async def fetch_github_profile(github_url: str) -> Dict[str, Any]:
    """Fetch public GitHub profile data without authentication.

    Returns a structured dict with user info, top languages, and top repos.
    Handles 404 and rate-limit errors gracefully.
    """
    username = _extract_github_username(github_url)
    if not username:
        return {"error": "Invalid GitHub URL or username could not be extracted."}

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "LinkedInAgentUI/1.0",
    }

    try:
        async with httpx.AsyncClient(timeout=GITHUB_API_TIMEOUT, headers=headers) as client:
            # Fetch user profile
            user_resp = await client.get(f"{GITHUB_API_BASE}/users/{username}")
            if user_resp.status_code == 404:
                return {"error": f"GitHub user '{username}' not found."}
            if user_resp.status_code == 403:
                return {"error": "GitHub API rate limit exceeded. Try again later."}
            user_resp.raise_for_status()
            user_data = user_resp.json()

            # Fetch repos (sorted by stars, max 30)
            repos_resp = await client.get(
                f"{GITHUB_API_BASE}/users/{username}/repos",
                params={"sort": "stars", "direction": "desc", "per_page": 30},
            )
            repos_data: List[Dict[str, Any]] = []
            if repos_resp.is_success:
                repos_data = repos_resp.json() if isinstance(repos_resp.json(), list) else []

            # Calculate top languages from repos
            language_counts: Dict[str, int] = {}
            for repo in repos_data:
                lang = repo.get("language")
                if lang:
                    language_counts[lang] = language_counts.get(lang, 0) + 1
            total_with_lang = sum(language_counts.values()) or 1
            top_languages = sorted(
                [
                    {"name": lang, "percentage": round(count / total_with_lang * 100, 1)}
                    for lang, count in language_counts.items()
                ],
                key=lambda x: x["percentage"],
                reverse=True,
            )[:5]

            # Top 3 repos
            top_repos = [
                {
                    "name": repo.get("name", ""),
                    "description": repo.get("description") or "",
                    "stars": repo.get("stargazers_count", 0),
                    "language": repo.get("language") or "",
                }
                for repo in repos_data[:3]
            ]

            # Contribution activity (events endpoint, last 90 events ~ last year approximation)
            contributions_last_year = 0
            try:
                events_resp = await client.get(
                    f"{GITHUB_API_BASE}/users/{username}/events/public",
                    params={"per_page": 100},
                )
                if events_resp.is_success:
                    events = events_resp.json() if isinstance(events_resp.json(), list) else []
                    # Count push events as a proxy for contributions
                    contributions_last_year = sum(
                        1 for ev in events if ev.get("type") in ("PushEvent", "PullRequestEvent", "IssuesEvent")
                    )
            except Exception:
                pass  # Non-critical

            return {
                "username": user_data.get("login", username),
                "bio": user_data.get("bio") or "",
                "public_repos": user_data.get("public_repos", 0),
                "top_languages": top_languages,
                "top_repos": top_repos,
                "contributions_last_year": contributions_last_year,
            }

    except httpx.HTTPStatusError as exc:
        logger.warning("GitHub API HTTP error for '%s': %s", username, exc)
        return {"error": f"GitHub API error: {exc.response.status_code}"}
    except httpx.TimeoutException:
        logger.warning("GitHub API timeout for '%s'", username)
        return {"error": "GitHub API request timed out."}
    except Exception as exc:
        logger.warning("GitHub fetch failed for '%s': %s", username, exc)
        return {"error": f"Failed to fetch GitHub profile: {str(exc)}"}
