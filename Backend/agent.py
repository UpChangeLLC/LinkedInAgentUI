"""
Career Analyzer AI Backend
- Multi-provider LLM support: OpenAI, Groq, Azure OpenAI
- LinkedIn fetch: Proxycurl (primary) → Anthropic web search (fallback)
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
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, TypedDict, Union

import docx
import httpx
import pdfplumber
from dotenv import load_dotenv
from openai import AsyncAzureOpenAI, AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


# ── Data containers ───────────────────────────────────────────────────────────

@dataclass
class SourceData:
    """Raw content from each source."""
    linkedin_raw: str
    resume_raw: str


class FetchGraphState(TypedDict):
    """LangGraph state for LinkedIn fetch flow."""
    linkedin_url: str
    raw_profile: str
    source: str
    fetch_failed: bool


# ── AI client factory ─────────────────────────────────────────────────────────

def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return AsyncOpenAI(api_key=api_key)


def get_groq_client() -> AsyncOpenAI:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return AsyncOpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")


def get_azure_openai_client() -> AsyncAzureOpenAI:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
    if not api_key:
        raise RuntimeError("AZURE_OPENAI_API_KEY is not set")
    if not endpoint:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT is not set")
    return AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
    )


def get_selected_ai_client() -> Tuple[str, Union[AsyncOpenAI, AsyncAzureOpenAI]]:
    """Return (provider_name, client) based on AI_CLIENT env var."""
    provider = os.getenv("AI_CLIENT", "openai").strip().lower()
    if provider == "openai":
        return provider, get_openai_client()
    if provider == "groq":
        return provider, get_groq_client()
    if provider == "azure":
        return provider, get_azure_openai_client()
    raise RuntimeError(f"Invalid AI_CLIENT='{provider}'. Use: openai | groq | azure")


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


# ── LinkedIn fetch — primary: Proxycurl ──────────────────────────────────────

async def fetch_linkedin_via_proxycurl(linkedin_url: str) -> str:
    """Fetch LinkedIn profile via Proxycurl API and return structured JSON string."""
    api_key = os.getenv("PROXYCURL_API_KEY")
    if not api_key:
        raise RuntimeError("PROXYCURL_API_KEY is not set")
    if "linkedin.com/in/" not in linkedin_url:
        raise ValueError("Invalid LinkedIn profile URL.")

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            "https://nubela.co/proxycurl/api/v2/linkedin",
            params={"url": linkedin_url, "use_cache": "if-present"},
            headers={"Authorization": f"Bearer {api_key}"},
        )
        response.raise_for_status()
        data = response.json()

    transformed = {
        "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        "headline": data.get("headline", ""),
        "summary": data.get("summary", ""),
        "location": f"{data.get('city', '')}, {data.get('country_full_name', '')}".strip(", "),
        "experiences": [
            {
                "title": exp.get("title"),
                "company": exp.get("company"),
                "duration": (
                    f"{exp.get('starts_at', {}).get('year', '')} - "
                    f"{exp.get('ends_at', {}).get('year', 'Present')}"
                ),
                "description": (exp.get("description") or "")[:300],
            }
            for exp in (data.get("experiences") or [])[:6]
        ],
        "education": [
            {
                "school": edu.get("school"),
                "degree": edu.get("degree_name"),
                "field": edu.get("field_of_study"),
            }
            for edu in (data.get("education") or [])[:4]
        ],
        "skills": [s.get("name") for s in (data.get("skills") or [])[:15]],
        "certifications": [c.get("name") for c in (data.get("certifications") or [])[:6]],
    }
    return json.dumps(transformed, ensure_ascii=True)


# ── LinkedIn fetch — fallback: Anthropic web search ──────────────────────────

def _anthropic_web_search_sync(query: str) -> str:
    """Run Anthropic web_search agentic loop and return final text response."""
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = anthropic.Anthropic(api_key=api_key)
    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    messages: List[Dict[str, Any]] = [{"role": "user", "content": query}]

    while True:
        response = client.messages.create(
            model=model,
            max_tokens=1500,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=messages,
        )
        tool_blocks = [b for b in response.content if b.type == "tool_use"]
        if tool_blocks:
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": b.id, "content": "Search completed."}
                    for b in tool_blocks
                ],
            })
        else:
            return " ".join(b.text for b in response.content if b.type == "text")


async def anthropic_web_search(query: str) -> str:
    """Async wrapper for Anthropic web search."""
    return await asyncio.to_thread(_anthropic_web_search_sync, query)


# ── LangGraph fetch flow ──────────────────────────────────────────────────────
# Flow: linkedin_fetch_node → (failed?) → web_search_node → done_node
#                           → (success?) → done_node

async def linkedin_fetch_node(state: FetchGraphState) -> FetchGraphState:
    """Primary fetch: try Proxycurl first."""
    logger.info("[1] Attempting Proxycurl fetch for: %s", state["linkedin_url"])
    try:
        raw = await fetch_linkedin_via_proxycurl(state["linkedin_url"])
        if raw and len(raw) > 100:
            logger.info("    Proxycurl fetch succeeded.")
            return {**state, "raw_profile": raw, "source": "proxycurl", "fetch_failed": False}
        return {**state, "raw_profile": "", "source": "", "fetch_failed": True}
    except Exception as exc:
        logger.warning("    Proxycurl failed: %s. Will try web search.", exc)
        return {**state, "raw_profile": "", "source": "", "fetch_failed": True}


async def web_search_node(state: FetchGraphState) -> FetchGraphState:
    """Fallback fetch: Anthropic web search."""
    logger.info("[2] Falling back to Anthropic web search.")
    try:
        query = (
            f"Find the professional background, career history, skills, education, "
            f"and work experience for the LinkedIn profile at {state['linkedin_url']}. "
            "Return all available details."
        )
        combined = await anthropic_web_search(query)
        keywords = [
            "experience", "education", "skills", "position",
            "worked", "university", "degree", "engineer", "manager",
        ]
        matched = sum(1 for k in keywords if k.lower() in combined.lower())
        if matched >= 3 and len(combined) > 200:
            logger.info("    Web search succeeded (%d keyword matches).", matched)
            return {**state, "raw_profile": combined, "source": "web_search", "fetch_failed": False}
        logger.warning("    Web search returned insufficient data (%d matches).", matched)
        return {**state, "raw_profile": "", "source": "web_search", "fetch_failed": True}
    except Exception as exc:
        logger.warning("    Web search failed: %s", exc)
        return {**state, "raw_profile": "", "source": "", "fetch_failed": True}


async def done_node(state: FetchGraphState) -> FetchGraphState:
    """Terminal passthrough node."""
    return state


def route_after_fetch(state: FetchGraphState) -> Literal["web_search_node", "done_node"]:
    """Route to web search only if primary fetch failed."""
    return "web_search_node" if state["fetch_failed"] else "done_node"


def build_fetch_graph():
    """Build and compile LinkedIn fetch LangGraph."""
    from langgraph.graph import END, StateGraph

    graph = StateGraph(FetchGraphState)
    graph.add_node("linkedin_fetch_node", linkedin_fetch_node)
    graph.add_node("web_search_node", web_search_node)
    graph.add_node("done_node", done_node)

    graph.set_entry_point("linkedin_fetch_node")
    graph.add_conditional_edges(
        "linkedin_fetch_node",
        route_after_fetch,
        {
            "web_search_node": "web_search_node",
            "done_node": "done_node",
        },
    )
    graph.add_edge("web_search_node", "done_node")
    graph.add_edge("done_node", END)
    return graph.compile()


async def fetch_linkedin_via_langgraph(linkedin_url: str) -> Tuple[str, str]:
    """Run LangGraph fetch flow and return (raw_profile, source)."""
    app = build_fetch_graph()
    final_state = await app.ainvoke({
        "linkedin_url": linkedin_url,
        "raw_profile": "",
        "source": "",
        "fetch_failed": False,
    })
    return final_state.get("raw_profile", ""), final_state.get("source", "unknown")


# ── LLM completion ────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def openai_json_completion(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Call selected AI provider with retry and return parsed JSON."""
    ai_client, client = get_selected_ai_client()
    model = get_selected_model(ai_client)
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


# ── Profile extraction ────────────────────────────────────────────────────────

async def extract_profile_structured(source_name: str, raw_text: str) -> Dict[str, Any]:
    """Extract structured profile from raw source text."""
    system_prompt = (
        "You are an expert resume and career parser. "
        "Return ONLY valid JSON with this exact structure: "
        "{"
        "  name, title, location, summary, "
        "  experiences: [{title, company, start, end, description}], "
        "  education: [{school, degree, field, start, end}], "
        "  skills: [string], "
        "  certifications: [string], "
        "  projects: [string], "
        "  last_updated_hint"
        "}. "
        "If any field is unknown use empty string or empty array. "
        "Infer the most recent information where possible."
    )
    user_prompt = (
        f"Source: {source_name}\n\n"
        f"Raw text:\n{raw_text[:12000]}"
    )
    return await openai_json_completion(system_prompt, user_prompt)


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

    system_prompt = (
        "You merge two candidate profiles (LinkedIn and resume). "
        "Return ONLY JSON with keys: {merged_profile, merge_notes}. "
        "Resolve conflicts by picking the more recent or more specific data. "
        "Prefer latest end dates and more detailed experience entries."
    )
    user_prompt = json.dumps(
        {"linkedin": linkedin_profile, "resume": resume_profile},
        ensure_ascii=True,
    )
    result = await openai_json_completion(system_prompt, user_prompt)
    return result.get("merged_profile", {})


# ── Career analysis ───────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are an expert career analyst and talent advisor.
Analyze the given professional profile and return ONLY valid JSON with this exact structure:

{
  "name": "Full Name",
  "title": "Current Job Title at Company",
  "initials": "AB",
  "location": "City, Country",

  "summary": "3-4 sentence professional summary of who this person is, what they do, and their key achievements",

  "profile_score": 7.5,
  "score_breakdown": {
    "experience_depth":     8,
    "skill_relevance":      7,
    "education":            7,
    "profile_completeness": 8,
    "career_progression":   7
  },
  "score_rationale": "2 sentence explanation justifying the overall score based on the breakdown",

  "ai_risk_assessment": {
    "overall_risk":      "Medium",
    "risk_score":        55,
    "summary":           "2-3 sentences on how exposed this person's role and skills are to AI automation in 2025-2026",
    "high_risk_skills":  ["Skill A", "Skill B"],
    "low_risk_skills":   ["Skill C", "Skill D"],
    "recommendation":    "One specific action this person should take to future-proof their career against AI"
  },

  "insights": {
    "strengths":        ["Strength 1", "Strength 2", "Strength 3"],
    "gaps":             ["Gap 1", "Gap 2"],
    "market_position":  "One sentence on how they compare to industry peers at their level"
  },

  "recommendations": [
    {"priority": "High",   "action": "Specific action 1", "reason": "Why this matters"},
    {"priority": "High",   "action": "Specific action 2", "reason": "Why this matters"},
    {"priority": "Medium", "action": "Specific action 3", "reason": "Why this matters"},
    {"priority": "Low",    "action": "Specific action 4", "reason": "Why this matters"}
  ],

  "top_skills":        ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"],
  "years_experience":  8,
  "roles_held":        4,
  "data_source":       "string"
}

Scoring rules:
- profile_score: float 0.0-10.0, computed as average of score_breakdown values
- score_breakdown values: integers 0-10
  - experience_depth:     years of experience + seniority level + impact
  - skill_relevance:      how in-demand their skills are in today's market
  - education:            degree level + certifications + continuous learning
  - profile_completeness: how complete and detailed the profile data is
  - career_progression:   growth trajectory, promotions, increasing responsibility

AI risk rules:
- overall_risk: one of Low | Medium | High | Very High
- risk_score: integer 0-100 (100 = fully automatable by AI)
- high_risk_skills: skills most likely to be automated in 2025-2026
- low_risk_skills: skills that require human judgment, creativity, relationships

Recommendation rules:
- priority: High | Medium | Low
- actions must be SPECIFIC and ACTIONABLE — not generic advice
- each recommendation must have a clear reason tied to the profile data

If profile data is insufficient for any field, use empty string or 0."""


async def analyze_profile(merged_profile: Dict[str, Any], data_source: str) -> Dict[str, Any]:
    """Generate structured career analysis from merged profile."""
    user_prompt = (
        f"data_source: {data_source}\n\n"
        f"Profile data:\n{json.dumps(merged_profile, ensure_ascii=True)[:14000]}"
    )
    result = await openai_json_completion(ANALYSIS_SYSTEM_PROMPT, user_prompt)
    result["data_source"] = data_source
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


async def run_pipeline(
    linkedin_url: str = "",
    resume_text: str = "",
) -> Dict[str, Any]:
    """
    Main pipeline: fetch → extract → merge → analyze.

    Args:
        linkedin_url: Public LinkedIn profile URL (optional)
        resume_text:  Extracted resume plain text (optional)

    Returns:
        Structured career analysis dict
    """
    if not linkedin_url and not resume_text:
        raise ValueError("At least one of linkedin_url or resume_text must be provided.")

    # ── Fetch LinkedIn data ───────────────────────────────────────────────────
    linkedin_raw = ""
    linkedin_source = ""

    if linkedin_url:
        if "linkedin.com/in/" not in linkedin_url:
            raise ValueError("Invalid LinkedIn URL. Must contain 'linkedin.com/in/'.")
        linkedin_raw, linkedin_source = await fetch_linkedin_via_langgraph(linkedin_url)
        if not linkedin_raw:
            logger.warning("Could not retrieve LinkedIn profile data from any source.")

    # ── Extract structured profiles ───────────────────────────────────────────
    linkedin_profile: Optional[Dict[str, Any]] = None
    resume_profile: Optional[Dict[str, Any]] = None

    if linkedin_raw:
        logger.info("Extracting structured profile from LinkedIn data (source: %s)", linkedin_source)
        linkedin_profile = await extract_profile_structured(linkedin_source, linkedin_raw)

    if resume_text:
        logger.info("Extracting structured profile from resume.")
        resume_profile = await extract_profile_structured("resume", resume_text)

    # ── Merge ─────────────────────────────────────────────────────────────────
    merged = await merge_profiles(linkedin_profile, resume_profile)
    if not merged:
        raise RuntimeError("No profile data available for analysis.")

    # ── Analyze ───────────────────────────────────────────────────────────────
    data_source = detect_data_source(bool(resume_text), bool(linkedin_url))
    logger.info("Running career analysis (source: %s)", data_source)
    return await analyze_profile(merged, data_source=data_source)


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
        if "linkedin.com/in/" in arg:
            return arg
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