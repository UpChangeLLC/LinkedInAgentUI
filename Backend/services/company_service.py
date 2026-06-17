"""Company context enrichment service (F7 — lightweight implementation)."""

from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import quote_plus


def _ai_posture_estimate(industry: str, company_name: str) -> str:
    """Heuristic AI posture estimation based on industry.

    Without paid company data APIs, we estimate from known industry patterns.
    """
    industry_lower = (industry or "").lower()
    mature_industries = {"technology", "saas", "software", "fintech", "ai", "data"}
    growing_industries = {
        "finance", "banking", "healthcare", "consulting", "media",
        "telecom", "insurance", "pharmaceutical", "automotive",
    }

    for keyword in mature_industries:
        if keyword in industry_lower:
            return "mature"
    for keyword in growing_industries:
        if keyword in industry_lower:
            return "growing"
    return "early"


def _discovery_links(company_name: str, industry: str) -> List[Dict[str, str]]:
    """Generate useful discovery links for company AI context."""
    q_company = quote_plus(company_name)
    q_industry = quote_plus(industry) if industry else "technology"

    links = [
        {
            "title": f"Google: {company_name} AI initiatives",
            "url": f"https://www.google.com/search?q={q_company}+AI+artificial+intelligence+strategy+2026",
        },
        {
            "title": f"Google News: {company_name} AI",
            "url": f"https://news.google.com/search?q={q_company}+AI+2026",
        },
        {
            "title": f"LinkedIn: {company_name} company page",
            "url": f"https://www.linkedin.com/company/{quote_plus(company_name.lower().replace(' ', '-'))}/",
        },
        {
            "title": f"Industry AI adoption: {industry}",
            "url": f"https://www.google.com/search?q={q_industry}+AI+adoption+rate+2026",
        },
        {
            "title": f"{company_name} on Crunchbase",
            "url": f"https://www.crunchbase.com/textsearch?q={q_company}",
        },
    ]
    return links


async def enrich_company(company_name: str, industry: str) -> Dict[str, Any]:
    """Return lightweight company context enrichment.

    Since we do not have paid company data APIs, this provides:
    - Google/LinkedIn search URLs for manual discovery
    - A heuristic AI posture estimate based on industry
    - Enrichment notes summarizing what was inferred

    Args:
        company_name: Name of the company.
        industry: Industry segment.

    Returns:
        Dict with company context data.
    """
    if not company_name:
        return {
            "company_name": "",
            "industry": industry or "",
            "ai_posture_estimate": "unknown",
            "discovery_links": [],
            "enrichment_notes": "No company name provided; company enrichment skipped.",
        }

    posture = _ai_posture_estimate(industry, company_name)
    links = _discovery_links(company_name, industry)

    posture_descriptions = {
        "early": (
            f"{company_name} operates in the {industry or 'general'} sector, "
            f"which is in the early stages of AI adoption. "
            f"Expect foundational investments in data infrastructure and pilot programs."
        ),
        "growing": (
            f"{company_name} operates in the {industry or 'general'} sector, "
            f"where AI adoption is accelerating. "
            f"Expect active AI tool integration and growing demand for AI-literate leaders."
        ),
        "mature": (
            f"{company_name} operates in the {industry or 'general'} sector, "
            f"which has mature AI adoption. "
            f"Expect AI-native workflows and competitive pressure to deploy advanced AI capabilities."
        ),
    }

    return {
        "company_name": company_name,
        "industry": industry or "",
        "ai_posture_estimate": posture,
        "discovery_links": links,
        "enrichment_notes": posture_descriptions.get(
            posture,
            f"AI posture for {company_name} could not be determined.",
        ),
    }
