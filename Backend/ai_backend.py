"""
Career Analyzer AI Backend
- Multi-provider LLM support: OpenAI, Groq, Azure OpenAI
- LinkedIn fetch: Apify (primary) → provider web search (fallback)
- Resume parsing: PDF, DOCX, TXT
- LangGraph agent for LinkedIn fetch flow
- Structured scoring, insights, and recommendations
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import sys
from urllib.parse import urlparse
from hashlib import sha1
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, TypedDict, Union
from dataclasses import dataclass

import docx
import httpx
import pdfplumber
from dotenv import load_dotenv
from openai import AsyncAzureOpenAI, AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from prompts import (
    ANALYSIS_SYSTEM_PROMPT,
    PROFILE_EXTRACTION_SYSTEM_PROMPT,
    PROFILE_MERGE_SYSTEM_PROMPT,
    ANALYSIS_SYSTEM_PROMPT_AGGRESSIVE ,
    AI_READINESS_SYSTEM_PROMPT,
    AI_READINESS_SYSTEM_PROMPT_v2,
    AI_READINESS_SYSTEM_PROMPT_v3,

)

load_dotenv()
load_dotenv("config.env", override=False)

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
os.environ.setdefault("LANGCHAIN_PROJECT", "linkedin-agent")
os.environ.setdefault("LANGCHAIN_API_KEY", os.getenv("LANGCHAIN_API_KEY", ""))
 
 
 
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


class AnalysisGraphState(TypedDict):
    """LangGraph state for end-to-end analysis pipeline."""

    linkedin_url: str
    resume_text: str
    linkedin_raw: str
    linkedin_source: str
    linkedin_profile: Dict[str, Any]
    resume_profile: Dict[str, Any]
    merged_profile: Dict[str, Any]
    data_source: str
    fetch_failed: bool
    trace: List[Dict[str, Any]]
    result: Dict[str, Any]
    error: str


# ── AI client factory ─────────────────────────────────────────────────────────


LINKEDIN_PROFILE_PATH_RE = re.compile(r"^/(in|pub)/[^/?#]+/?$", re.IGNORECASE)


def normalize_linkedin_profile_url(url: str) -> str:
    """Normalize and validate LinkedIn profile URL. Returns empty string when invalid."""
    raw = (url or "").strip()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlparse(candidate)
    except Exception:
        return ""
    host = (parsed.netloc or "").lower()
    if not host:
        return ""
    if host.startswith("www."):
        host = host[4:]
    if "linkedin." not in host:
        return ""
    path = parsed.path or ""
    if not LINKEDIN_PROFILE_PATH_RE.match(path):
        return ""
    normalized_path = path.rstrip("/")
    return f"https://{host}{normalized_path}"

@dataclass
class MCPConfig:
    """Optional Model Context Protocol configuration (for IDE tool integration).

    Note: MCP servers like browser extensions are IDE-local and typically not
    reachable from this backend service at runtime. We only expose configuration
    and log status for observability; no runtime dependency is introduced.
    """
    enabled: bool
    server: str
    tools: List[str]
    timeout_sec: float


def load_mcp_config() -> MCPConfig:
    """Load MCP configuration from environment variables."""
    enabled = os.getenv("MCP_ENABLED", "0").strip() in {"1", "true", "yes"}
    server = os.getenv("MCP_SERVER", "").strip()
    tools_raw = os.getenv("MCP_TOOLS", "").strip()
    tools = [t.strip() for t in tools_raw.split(",") if t.strip()] if tools_raw else []
    try:
        timeout_sec = float(os.getenv("MCP_TIMEOUT_SEC", "30").strip())
    except Exception:
        timeout_sec = 30.0
    return MCPConfig(enabled=enabled, server=server, tools=tools, timeout_sec=timeout_sec)

def get_openai_client() -> AsyncOpenAI:
    """Initialize OpenAI-compatible client for selected OpenAI endpoint."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
    timeout = float(os.getenv("AI_CLIENT_TIMEOUT_SEC", "60"))
    max_retries = int(os.getenv("AI_CLIENT_MAX_RETRIES", "2"))
    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
        max_retries=max_retries,
    )


def get_groq_client() -> AsyncOpenAI:
    """Initialize Groq through OpenAI-compatible client."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    timeout = float(os.getenv("AI_CLIENT_TIMEOUT_SEC", "60"))
    max_retries = int(os.getenv("AI_CLIENT_MAX_RETRIES", "2"))
    return AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout,
        max_retries=max_retries,
    )


def get_azure_openai_client() -> AsyncAzureOpenAI:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
    timeout = float(os.getenv("AI_CLIENT_TIMEOUT_SEC", "60"))
    max_retries = int(os.getenv("AI_CLIENT_MAX_RETRIES", "2"))
    if not api_key:
        raise RuntimeError("AZURE_OPENAI_API_KEY is not set")
    if not endpoint:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT is not set")
    return AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
        timeout=timeout,
        max_retries=max_retries,
    )


def get_selected_ai_client() -> Tuple[str, Optional[Union[AsyncOpenAI, AsyncAzureOpenAI]]]:
    """Return (provider_name, client) based on AI_CLIENT env var."""
    provider = os.getenv("AI_CLIENT", "openai").strip().lower()
    if provider == "openai":
        return provider, get_openai_client()
    if provider == "groq":
        return provider, get_groq_client()
    if provider == "azure":
        return provider, get_azure_openai_client()
    if provider == "anthropic":
        return provider, None
    raise RuntimeError(f"Invalid AI_CLIENT='{provider}'. Use: openai | groq | azure | anthropic")


def get_selected_model(ai_client: str) -> str:
    """Return model name for the selected provider."""
    if ai_client == "openai":
        return os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    if ai_client == "groq":
        return os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
    if ai_client == "azure":
        model = os.getenv("AZURE_OPENAI_DEPLOYMENT")
        if not model:
            raise RuntimeError("AZURE_OPENAI_DEPLOYMENT is not set")
        return model
    if ai_client == "anthropic":
        return os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    raise RuntimeError(f"Invalid AI_CLIENT='{ai_client}'")


# ── Resume extraction ─────────────────────────────────────────────────────────

def _extract_text_from_resume_sync(file_name: str, file_bytes: bytes) -> str:
    """Extract plain text from PDF, DOCX, or TXT."""
    lower = file_name.lower()
    if lower.endswith(".pdf"):
        texts: List[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                texts.append(page.extract_text() or "")
        return "\n".join(texts).strip()
    if lower.endswith(".docx"):
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in document.paragraphs).strip()
    if lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore").strip()
    raise ValueError("Unsupported resume format. Use PDF, DOCX, or TXT.")


async def extract_text_from_resume(file_name: str, file_bytes: bytes) -> str:
    """Non-blocking resume text extraction."""
    return await asyncio.to_thread(_extract_text_from_resume_sync, file_name, file_bytes)


# ── LinkedIn fetch — primary: Apify with cache reuse ─────────────────────────

def _linkedin_cache_key(linkedin_url: str) -> str:
    """Create a stable cache key for a LinkedIn profile URL."""
    normalized = linkedin_url.strip().lower().rstrip("/")
    return sha1(normalized.encode("utf-8")).hexdigest()


def _load_apify_cache(cache_file: Path) -> Dict[str, str]:
    """Load local LinkedIn->dataset cache map. Legacy fallback only."""
    if not cache_file.exists():
        return {}
    try:
        return json.loads(cache_file.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_apify_cache(cache_file: Path, data: Dict[str, str]) -> None:
    """Persist local LinkedIn->dataset cache map. Legacy fallback only."""
    cache_file.write_text(json.dumps(data, indent=2), encoding="utf-8")


async def _apify_get_dataset_items(dataset_id: str, token: str) -> List[Dict[str, Any]]:
    """Read items from an Apify dataset."""
    url = f"https://api.apify.com/v2/datasets/{dataset_id}/items"
    params = {"token": token, "clean": "true"}
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
    return payload if isinstance(payload, list) else []


async def _apify_run_actor(actor_id: str, token: str, run_input: Dict[str, Any]) -> Dict[str, Any]:
    """Run Apify actor and wait for completion."""
    variants = [actor_id]
    if "/" in actor_id:
        variants.append(actor_id.replace("/", "~", 1))
    elif "~" in actor_id:
        variants.append(actor_id.replace("~", "/", 1))

    last_error = ""
    params = {"token": token, "waitForFinish": 120}
    for candidate in variants:
        url = f"https://api.apify.com/v2/acts/{candidate}/runs"
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, params=params, json=run_input)
        if response.is_success:
            return response.json().get("data", {})
        last_error = f"{response.status_code}: {response.text[:200]}"
    raise RuntimeError(f"Apify actor run failed for '{actor_id}'. Last error: {last_error}")


async def fetch_linkedin_via_apify(linkedin_url: str) -> str:
    """Fetch LinkedIn profile via Apify, reusing prior dataset for same profile when available.

    Cache lookup order: Redis → PostgreSQL → file. Cache writes go to all backends.
    """
    from services.apify_cache_service import get_cached_dataset, set_cached_dataset

    token = os.getenv("APIFY_API_TOKEN", "").strip()
    actor_id = os.getenv("APIFY_ACTOR_ID", "supreme_coder/linkedin-profile-scraper").strip()
    if not token:
        raise RuntimeError("APIFY_API_TOKEN is not set")
    normalized_url = normalize_linkedin_profile_url(linkedin_url)
    if not normalized_url:
        raise ValueError("Invalid LinkedIn profile URL.")

    key = _linkedin_cache_key(normalized_url)

    # --- Cache read (Redis → PG → file) ---
    cached = await get_cached_dataset(key)
    if cached:
        # If raw_data is stored, return it directly
        if cached.get("raw_data"):
            return json.dumps(cached["raw_data"], ensure_ascii=True)
        # Otherwise re-fetch from dataset
        dataset_id = cached.get("dataset_id", "")
        if dataset_id:
            try:
                items = await _apify_get_dataset_items(dataset_id, token)
                if items:
                    return json.dumps(items[0], ensure_ascii=True)
            except Exception:
                pass

    # --- Fresh scrape ---
    run_input = {
        "urls": [{"url": normalized_url}],
        "findContacts.contactCompassToken": "",
    }
    run_data = await _apify_run_actor(actor_id=actor_id, token=token, run_input=run_input)
    dataset_id = run_data.get("defaultDatasetId", "")
    if not dataset_id:
        raise RuntimeError("Apify actor did not return defaultDatasetId")
    items = await _apify_get_dataset_items(dataset_id, token)
    if not items:
        raise RuntimeError("Apify dataset returned no items")

    # --- Cache write (Redis + PG + file) ---
    raw_data = items[0]
    await set_cached_dataset(
        url_hash=key,
        dataset_id=dataset_id,
        raw_data=raw_data,
        linkedin_url=normalized_url,
        actor_id=actor_id,
    )
    return json.dumps(raw_data, ensure_ascii=True)


def _extract_json_from_text(text: str) -> Dict[str, Any]:
    """Extract first JSON object from text payload."""
    clean = re.sub(r"```json|```", "", text).strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Provider response did not contain valid JSON")
    return json.loads(clean[start : end + 1])


def _run_provider_sync(
    provider: str,
    system_prompt: str,
    user_prompt: str,
    with_web_search: bool,
) -> str:
    """Run provider call in sync mode for providers that need blocking SDK usage."""
    if provider != "anthropic":
        raise RuntimeError(f"Sync provider call not supported for provider '{provider}'")

    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    model = get_selected_model(provider)
    client = anthropic.Anthropic(api_key=api_key)

    if not with_web_search:
        response = client.messages.create(
            model=model,
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return " ".join(block.text for block in response.content if getattr(block, "type", "") == "text")

    messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]
    while True:
        response = client.messages.create(
            model=model,
            max_tokens=1500,
            system=system_prompt,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=messages,
        )
        tool_blocks = [block for block in response.content if getattr(block, "type", "") == "tool_use"]
        if tool_blocks:
            messages.append({"role": "assistant", "content": response.content})
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": block.id, "content": "Search completed."}
                        for block in tool_blocks
                    ],
                }
            )
            continue
        return " ".join(block.text for block in response.content if getattr(block, "type", "") == "text")


async def call_web_search_tool(query: str) -> str:
    """Call provider web-search tool (defaults to AI_CLIENT unless overridden)."""
    # Log MCP configuration status for observability (non-functional placeholder).
    mcp_cfg = load_mcp_config()
    if mcp_cfg.enabled:
        logger.info(
            "MCP is enabled (server=%s, tools=%s, timeout=%.1fs). Backend does not invoke MCP directly.",
            mcp_cfg.server or "n/a",
            ",".join(mcp_cfg.tools) if mcp_cfg.tools else "none",
            mcp_cfg.timeout_sec,
        )

    # WEB_SEARCH_CLIENT is optional; if not set we use the main AI_CLIENT.
    provider = os.getenv("WEB_SEARCH_CLIENT", "").strip().lower() or os.getenv("AI_CLIENT", "openai").strip().lower()
    if provider == "groq":
        logger.warning("WEB_SEARCH_CLIENT resolved to groq; falling back to anthropic for web search.")
        provider = "anthropic"
    if provider == "anthropic":
        return await asyncio.to_thread(
            _run_provider_sync,
            provider,
            "Use web search to gather accurate profile data.",
            query,
            True,
        )
    if provider in {"openai", "azure"}:
        # Do not depend on AI_CLIENT config for web-search provider selection.
        # WEB_SEARCH_CLIENT may intentionally differ from AI_CLIENT.
        client = get_openai_client() if provider == "openai" else get_azure_openai_client()
        model = get_selected_model(provider)
        response = await client.responses.create(
            model=model,
            tools=[{"type": "web_search_preview"}],
            input=[
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": "Use web search to gather accurate profile data."}],
                },
                {"role": "user", "content": [{"type": "input_text", "text": query}]},
            ],
        )
        output_text = getattr(response, "output_text", "") or ""
        if output_text:
            return output_text
        raise RuntimeError("Web search returned empty output")
    raise RuntimeError(
        f"WEB_SEARCH_CLIENT '{provider}' is not supported for web search tools. "
        "Use: openai | azure | anthropic"
    )


# ── LLM completion ────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def llm_json_completion(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Call selected AI provider and return parsed JSON."""
    provider, client = get_selected_ai_client()
    model = get_selected_model(provider)
    if provider == "anthropic":
        text = await asyncio.to_thread(_run_provider_sync, provider, system_prompt, user_prompt, False)
        return _extract_json_from_text(text)
    if client is None:
        raise RuntimeError(f"No client initialized for provider '{provider}'")
    response = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


# ── Input sanitization ────────────────────────────────────────────────────────

def sanitize_for_llm(text: str, max_chars: int = 50_000) -> str:
    """Strip control characters and truncate before passing to LLM prompts."""
    # Remove ASCII control chars except newline/tab
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return cleaned[:max_chars]


# ── Profile extraction ────────────────────────────────────────────────────────

async def extract_profile_structured(source_name: str, raw_text: str) -> Dict[str, Any]:
    """Extract structured profile from raw source text."""
    safe_text = sanitize_for_llm(raw_text, max_chars=12_000)
    user_prompt = (
        f"Source: {source_name}\n\n"
        f"<user_input>\n{safe_text}\n</user_input>"
    )
    return await llm_json_completion(PROFILE_EXTRACTION_SYSTEM_PROMPT, user_prompt)


# ── Profile merge ─────────────────────────────────────────────────────────────

async def merge_profiles(
    linkedin_profile: Optional[Dict[str, Any]],
    resume_profile: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Merge LinkedIn and resume profiles, preferring most recent/detailed data."""
    if not linkedin_profile and not resume_profile:
        return {}
    if linkedin_profile and not resume_profile:
        return linkedin_profile
    if resume_profile and not linkedin_profile:
        return resume_profile

    raw = json.dumps(
        {"linkedin": linkedin_profile, "resume": resume_profile},
        ensure_ascii=True,
    )
    user_prompt = f"<user_input>\n{sanitize_for_llm(raw, max_chars=20_000)}\n</user_input>"
    result = await llm_json_completion(PROFILE_MERGE_SYSTEM_PROMPT, user_prompt)
    return result.get("merged_profile", {})


# ── Career analysis ───────────────────────────────────────────────────────────

async def analyze_profile(merged_profile: Dict[str, Any], data_source: str) -> Dict[str, Any]:
    """Generate structured career analysis from merged profile."""
    profile_json = sanitize_for_llm(json.dumps(merged_profile, ensure_ascii=True), max_chars=14_000)
    user_prompt = (
        f"data_source: {data_source}\n\n"
        f"<user_input>\n{profile_json}\n</user_input>"
    )
    result = await llm_json_completion(AI_READINESS_SYSTEM_PROMPT_v2, user_prompt)
    result["data_source"] = data_source
    # Backward compatibility: older UI code expects strengths/gaps at top level.
    insights = result.get("insights", {}) if isinstance(result.get("insights", {}), dict) else {}
    if not result.get("strengths"):
        result["strengths"] = insights.get("strengths", [])
    if not result.get("gaps"):
        result["gaps"] = insights.get("gaps", [])
    result.setdefault("job_recommendations", [])
    result.setdefault("upskilling_plan", [])
    result.setdefault("action_timeline_30_60_90", {"day_0_30": [], "day_31_60": [], "day_61_90": []})
    risk = result.get("ai_risk_assessment", {})
    if isinstance(risk, dict):
        risk.setdefault("risk_drivers", [])
    else:
        result["ai_risk_assessment"] = {
            "overall_risk": "",
            "risk_score": 0,
            "summary": "",
            "high_risk_skills": [],
            "low_risk_skills": [],
            "recommendation": "",
            "risk_drivers": [],
        }
    return result


# ── Pipeline orchestrator ─────────────────────────────────────────────────────

def detect_data_source(has_resume: bool, has_linkedin: bool) -> str:
    if has_resume and has_linkedin:
        return "linkedin+resume_merged"
    if has_resume:
        return "resume"
    if has_linkedin:
        return "linkedin"
    return "none"


def _append_trace(
    state: AnalysisGraphState,
    *,
    step: str,
    start_time: float,
    success: bool,
    info: str = "",
) -> AnalysisGraphState:
    """Append one node timing entry to state trace."""
    trace = list(state.get("trace", []))
    trace.append(
        {
            "step": step,
            "success": success,
            "duration_ms": int((asyncio.get_running_loop().time() - start_time) * 1000),
            "info": info,
        }
    )
    return {**state, "trace": trace}


async def validate_input_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Validate input once at the start and compute source metadata."""
    start_time = asyncio.get_running_loop().time()
    linkedin_url_raw = (state.get("linkedin_url") or "").strip()
    linkedin_url = normalize_linkedin_profile_url(linkedin_url_raw)
    resume_text = (state.get("resume_text") or "").strip()
    if not linkedin_url and not resume_text:
        next_state = {**state, "error": "At least one of linkedin_url or resume_text must be provided."}
        return _append_trace(
            next_state,
            step="validate_input_node",
            start_time=start_time,
            success=False,
            info="missing_input",
        )
    if linkedin_url_raw and not linkedin_url:
        # If resume exists, continue with resume-only flow instead of failing the run.
        if resume_text:
            linkedin_url = ""
            next_state = {
                **state,
                "linkedin_url": linkedin_url,
                "resume_text": resume_text,
                "data_source": detect_data_source(bool(resume_text), bool(linkedin_url)),
            }
            return _append_trace(
                next_state,
                step="validate_input_node",
                start_time=start_time,
                success=True,
                info="invalid_linkedin_ignored_resume_used",
            )
        next_state = {**state, "error": "Invalid LinkedIn URL. Must contain 'linkedin.com/in/'."}
        return _append_trace(
            next_state,
            step="validate_input_node",
            start_time=start_time,
            success=False,
            info="invalid_linkedin_url",
        )
    next_state = {
        **state,
        "linkedin_url": linkedin_url,
        "resume_text": resume_text,
        "data_source": detect_data_source(bool(resume_text), bool(linkedin_url)),
    }
    return _append_trace(
        next_state,
        step="validate_input_node",
        start_time=start_time,
        success=True,
        info=f"data_source={next_state.get('data_source', 'none')}",
    )


def route_after_validate(state: AnalysisGraphState) -> Literal["error_node", "fetch_sources_node"]:
    """Route flow based on validation status."""
    return "error_node" if state.get("error") else "fetch_sources_node"


async def fetch_sources_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Primary LinkedIn fetch node: try Apify first with dataset cache reuse."""
    start_time = asyncio.get_running_loop().time()
    linkedin_url = state.get("linkedin_url", "")
    if not linkedin_url:
        next_state = {**state, "linkedin_raw": "", "linkedin_source": "", "fetch_failed": False}
        return _append_trace(
            next_state,
            step="fetch_sources_node",
            start_time=start_time,
            success=True,
            info="skipped_no_linkedin",
        )
    logger.info("[1] Attempting Apify fetch for: %s", linkedin_url)
    try:
        raw = await fetch_linkedin_via_apify(linkedin_url)
        if raw and len(raw) > 100:
            logger.info("    Apify fetch succeeded.")
            next_state = {**state, "linkedin_raw": raw, "linkedin_source": "apify", "fetch_failed": False}
            return _append_trace(
                next_state,
                step="fetch_sources_node",
                start_time=start_time,
                success=True,
                info="source=apify",
            )
    except Exception as exc:
        logger.warning("    Apify fetch failed: %s. Will try web search.", exc)
    next_state = {**state, "linkedin_raw": "", "linkedin_source": "", "fetch_failed": True}
    return _append_trace(
        next_state,
        step="fetch_sources_node",
        start_time=start_time,
        success=False,
        info="apify_failed",
    )


def route_after_primary_fetch(state: AnalysisGraphState) -> Literal["web_search_node", "extract_profiles_node"]:
    """Route to web-search fallback only when primary LinkedIn fetch fails."""
    if not state.get("linkedin_url"):
        return "extract_profiles_node"
    return "web_search_node" if state.get("fetch_failed", False) else "extract_profiles_node"


async def web_search_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Fallback LinkedIn fetch using model web-search tool."""
    start_time = asyncio.get_running_loop().time()
    linkedin_url = state.get("linkedin_url", "")
    if not linkedin_url:
        return _append_trace(
            state,
            step="web_search_node",
            start_time=start_time,
            success=True,
            info="skipped_no_linkedin",
        )
    logger.info("[2] Falling back to provider web search.")
    try:
        query = (
            f"Find the professional background, career history, skills, education, "
            f"and work experience for the LinkedIn profile at {linkedin_url}. "
            "Return all available details."
        )
        combined = await call_web_search_tool(query)
        keywords = [
            "experience", "education", "skills", "position",
            "worked", "university", "degree", "engineer", "manager",
        ]
        matched = sum(1 for key in keywords if key.lower() in combined.lower())
        if matched >= 3 and len(combined) > 200:
            logger.info("    Web search succeeded (%d keyword matches).", matched)
            next_state = {**state, "linkedin_raw": combined, "linkedin_source": "web_search", "fetch_failed": False}
            return _append_trace(
                next_state,
                step="web_search_node",
                start_time=start_time,
                success=True,
                info=f"keyword_matches={matched}",
            )
        logger.warning("    Web search returned insufficient data (%d matches).", matched)
    except Exception as exc:
        logger.warning("    Web search failed: %s", exc)
    next_state = {**state, "linkedin_raw": "", "linkedin_source": "", "fetch_failed": True}
    return _append_trace(
        next_state,
        step="web_search_node",
        start_time=start_time,
        success=False,
        info="fallback_failed",
    )


async def extract_profiles_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Convert raw text sources into structured profile JSON."""
    start_time = asyncio.get_running_loop().time()
    linkedin_profile: Dict[str, Any] = {}
    resume_profile: Dict[str, Any] = {}

    linkedin_raw = state.get("linkedin_raw", "")
    resume_text = state.get("resume_text", "")

    if linkedin_raw:
        linkedin_profile = await extract_profile_structured(
            state.get("linkedin_source", "linkedin"),
            linkedin_raw,
        )
    if resume_text:
        resume_profile = await extract_profile_structured("resume", resume_text)
    next_state = {
        **state,
        "linkedin_profile": linkedin_profile,
        "resume_profile": resume_profile,
    }
    return _append_trace(
        next_state,
        step="extract_profiles_node",
        start_time=start_time,
        success=bool(linkedin_profile or resume_profile),
        info=f"linkedin={bool(linkedin_profile)} resume={bool(resume_profile)}",
    )


async def merge_profiles_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Merge LinkedIn + resume profiles into a single canonical profile."""
    start_time = asyncio.get_running_loop().time()
    merged = await merge_profiles(
        state.get("linkedin_profile") or None,
        state.get("resume_profile") or None,
    )
    if not merged:
        next_state = {**state, "error": "No profile data available for analysis."}
        return _append_trace(
            next_state,
            step="merge_profiles_node",
            start_time=start_time,
            success=False,
            info="empty_merged_profile",
        )
    next_state = {**state, "merged_profile": merged}
    return _append_trace(
        next_state,
        step="merge_profiles_node",
        start_time=start_time,
        success=True,
        info="merged",
    )


def route_after_merge(state: AnalysisGraphState) -> Literal["error_node", "analyze_node_graph"]:
    """Route to analysis only when merged profile is available."""
    return "error_node" if state.get("error") else "analyze_node_graph"


async def analyze_node_graph(state: AnalysisGraphState) -> AnalysisGraphState:
    """Run final scoring/risk/recommendation analysis."""
    start_time = asyncio.get_running_loop().time()
    result = await analyze_profile(
        merged_profile=state.get("merged_profile", {}),
        data_source=state.get("data_source", "none"),
    )
    next_state = {**state, "result": result}
    return _append_trace(
        next_state,
        step="analyze_node_graph",
        start_time=start_time,
        success=True,
        info="analysis_complete",
    )


async def error_node(state: AnalysisGraphState) -> AnalysisGraphState:
    """Terminal error node."""
    start_time = asyncio.get_running_loop().time()
    return _append_trace(
        state,
        step="error_node",
        start_time=start_time,
        success=False,
        info=state.get("error", "error"),
    )


def build_analysis_graph():
    """Build the single LangGraph pipeline used by the backend."""
    from langgraph.graph import END, StateGraph

    graph = StateGraph(AnalysisGraphState)
    graph.add_node("validate_input_node", validate_input_node)
    graph.add_node("fetch_sources_node", fetch_sources_node)
    graph.add_node("web_search_node", web_search_node)
    graph.add_node("extract_profiles_node", extract_profiles_node)
    graph.add_node("merge_profiles_node", merge_profiles_node)
    graph.add_node("analyze_node_graph", analyze_node_graph)
    graph.add_node("error_node", error_node)

    # validate -> fetch -> optional web search fallback -> extract -> merge -> analyze
    graph.set_entry_point("validate_input_node")
    graph.add_conditional_edges(
        "validate_input_node",
        route_after_validate,
        {
            "fetch_sources_node": "fetch_sources_node",
            "error_node": "error_node",
        },
    )
    graph.add_conditional_edges(
        "fetch_sources_node",
        route_after_primary_fetch,
        {
            "web_search_node": "web_search_node",
            "extract_profiles_node": "extract_profiles_node",
        },
    )
    graph.add_edge("web_search_node", "extract_profiles_node")
    graph.add_edge("extract_profiles_node", "merge_profiles_node")
    graph.add_conditional_edges(
        "merge_profiles_node",
        route_after_merge,
        {
            "analyze_node_graph": "analyze_node_graph",
            "error_node": "error_node",
        },
    )
    graph.add_edge("analyze_node_graph", END)
    graph.add_edge("error_node", END)
    compiled = graph.compile()

    # Optional graph visualization for local debugging, compatible across versions.
    # Enable with: EXPORT_LANGGRAPH_VIS=1
    if os.getenv("EXPORT_LANGGRAPH_VIS", "").strip() == "1":
        try:
            graph_view = compiled.get_graph()
            if hasattr(graph_view, "draw_mermaid_png"):
                png_bytes = graph_view.draw_mermaid_png()
                Path("analysis_graph.png").write_bytes(png_bytes)
            if hasattr(graph_view, "draw_ascii"):
                logger.info("\n%s", graph_view.draw_ascii())
        except Exception as exc:
            logger.warning("Unable to export LangGraph visualization: %s", exc)
    return compiled


def _initial_analysis_state(linkedin_url: str, resume_text: str) -> AnalysisGraphState:
    """Create the initial state object for LangGraph invocation."""
    return {
        "linkedin_url": linkedin_url,
        "resume_text": resume_text,
        "linkedin_raw": "",
        "linkedin_source": "",
        "linkedin_profile": {},
        "resume_profile": {},
        "merged_profile": {},
        "data_source": "none",
        "fetch_failed": False,
        "trace": [],
        "result": {},
        "error": "",
    }


async def run_pipeline_with_trace(
    linkedin_url: str = "",
    resume_text: str = "",
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Run pipeline and return (result, node_trace)."""
    # async def _broadcast_to_mcp_payload(result: Dict[str, Any], trace: List[Dict[str, Any]]) -> None:
    #     """Optionally broadcast final payload to MCP sinks (file/webhook). Non-fatal on error."""
    #     # File sink
    #     out_path = os.getenv("MCP_OUTPUT_FILE", "").strip()
    #     if out_path:
    #         try:
    #             payload = {"result": result, "trace": trace}
    #             Path(out_path).write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    #             logger.info("MCP output written to file: %s", out_path)
    #         except Exception as exc:
    #             logger.warning("Failed to write MCP_OUTPUT_FILE '%s': %s", out_path, exc)
    #     # Webhook sink
    #     webhook_url = os.getenv("MCP_WEBHOOK_URL", "").strip()
    #     if webhook_url:
    #         try:
    #             timeout = float(os.getenv("MCP_TIMEOUT_SEC", os.getenv("MCP_TIMEOUT", "30")).strip() or 30.0)
    #         except Exception:
    #             timeout = 30.0
    #         try:
    #             async with httpx.AsyncClient(timeout=timeout) as client:
    #                 await client.post(
    #                     webhook_url,
    #                     json={"result": result, "trace": trace},
    #                     headers={"Content-Type": "application/json"},
    #                 )
    #             logger.info("MCP webhook POST succeeded: %s", webhook_url)
    #         except Exception as exc:
    #             logger.warning("MCP webhook POST failed to '%s': %s", webhook_url, exc)

    app = build_analysis_graph()
    final_state = await app.ainvoke(_initial_analysis_state(linkedin_url, resume_text))
    if final_state.get("error"):
        raise RuntimeError(final_state["error"])
    result = final_state.get("result", {})
    if not result:
        raise RuntimeError("Pipeline completed without result.")
    trace = final_state.get("trace", [])
    # Fire-and-forget broadcast (do not block main return on any failure).
    # try:
    #     await _broadcast_to_mcp_payload(result, trace)
    # except Exception as exc:
    #     logger.debug("Non-fatal MCP broadcast error: %s", exc)
    return result, trace


async def run_pipeline(
    linkedin_url: str = "",
    resume_text: str = "",
) -> Dict[str, Any]:
    """Run the single LangGraph pipeline and return analyzed profile JSON."""
    result, _ = await run_pipeline_with_trace(linkedin_url=linkedin_url, resume_text=resume_text)
    return result


# ── CLI entry point ───────────────────────────────────────────────────────────

def _resolve_resume_path() -> Optional[Path]:
    """Resolve optional resume PDF path from CLI args."""
    for arg in sys.argv[1:]:
        p = Path(arg).expanduser().resolve()
        if p.suffix.lower() in {".pdf", ".docx", ".txt"} and p.exists():
            return p
    return None


def _resolve_linkedin_url() -> str:
    """Resolve optional LinkedIn URL from CLI args."""
    for arg in sys.argv[1:]:
        normalized = normalize_linkedin_profile_url(arg)
        if normalized:
            return normalized
    return ""


async def main() -> None:
    """
    CLI entry point. Accepts any combination of:
      python ai_backend.py <resume.pdf>
      python ai_backend.py <linkedin_url>
      python ai_backend.py <resume.pdf> <linkedin_url>
    """
    resume_text = ""
    linkedin_url = _resolve_linkedin_url()
    resume_path = _resolve_resume_path()

    if resume_path:
        logger.info("Loading resume: %s", resume_path)
        resume_text = await extract_text_from_resume(
            resume_path.name,
            resume_path.read_bytes(),
        )

    if not linkedin_url and not resume_text:
        print("Usage:")
        print("  python ai_backend.py <resume.pdf>")
        print("  python ai_backend.py <linkedin_url>")
        print("  python ai_backend.py <resume.pdf> <linkedin_url>")
        sys.exit(1)

    result = await run_pipeline(linkedin_url=linkedin_url, resume_text=resume_text)
    print(json.dumps(result, indent=2, ensure_ascii=True))

    output_path = Path("career_analysis.json")
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=True))
    logger.info("Saved to %s", output_path)


if __name__ == "__main__":
    asyncio.run(main())
