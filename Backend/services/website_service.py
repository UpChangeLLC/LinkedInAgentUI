"""Website content fetching service for multi-signal input (F2)."""

from __future__ import annotations

import logging
import re
from html.parser import HTMLParser
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

WEBSITE_TIMEOUT = 15.0
MAX_TEXT_CHARS = 5000


class _SimpleHTMLTextExtractor(HTMLParser):
    """Minimal HTML parser that extracts visible text and the <title> tag."""

    def __init__(self) -> None:
        super().__init__()
        self.title: str = ""
        self.text_parts: List[str] = []
        self.links: List[str] = []
        self._in_title = False
        self._skip_tags = {"script", "style", "noscript", "svg", "head"}
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: List[tuple]) -> None:
        if tag in self._skip_tags:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "a":
            for name, value in attrs:
                if name == "href" and value:
                    self.links.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag in self._skip_tags and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if self._in_title:
            self.title = text
        if self._skip_depth == 0:
            self.text_parts.append(text)


def _normalize_url(url: str) -> str:
    """Ensure URL has a scheme."""
    raw = (url or "").strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    try:
        parsed = urlparse(raw)
        if not parsed.netloc:
            return ""
        return raw
    except Exception:
        return ""


async def fetch_website_content(url: str) -> Dict[str, Any]:
    """Fetch a website URL and extract text content.

    Returns a structured dict with URL, title, text content (first 5000 chars),
    and extracted links. Handles errors gracefully.
    """
    normalized = _normalize_url(url)
    if not normalized:
        return {"error": "Invalid URL provided."}

    try:
        async with httpx.AsyncClient(
            timeout=WEBSITE_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "LinkedInAgentUI/1.0"},
        ) as client:
            resp = await client.get(normalized)
            if resp.status_code == 404:
                return {"error": f"URL not found (404): {normalized}"}
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type and "text/plain" not in content_type:
                return {
                    "url": normalized,
                    "title": "",
                    "text_content": f"[Non-HTML content: {content_type}]",
                    "extracted_links": [],
                }

            html_body = resp.text
            parser = _SimpleHTMLTextExtractor()
            parser.feed(html_body)

            # Join text, collapse whitespace
            full_text = " ".join(parser.text_parts)
            full_text = re.sub(r"\s+", " ", full_text).strip()

            # Filter links to absolute URLs only
            extracted_links = [
                link for link in parser.links
                if link.startswith(("http://", "https://"))
            ][:20]  # Cap at 20 links

            return {
                "url": normalized,
                "title": parser.title,
                "text_content": full_text[:MAX_TEXT_CHARS],
                "extracted_links": extracted_links,
            }

    except httpx.HTTPStatusError as exc:
        logger.warning("Website fetch HTTP error for '%s': %s", normalized, exc)
        return {"error": f"HTTP error {exc.response.status_code} fetching {normalized}"}
    except httpx.TimeoutException:
        logger.warning("Website fetch timeout for '%s'", normalized)
        return {"error": f"Request timed out fetching {normalized}"}
    except Exception as exc:
        logger.warning("Website fetch failed for '%s': %s", normalized, exc)
        return {"error": f"Failed to fetch website: {str(exc)}"}
