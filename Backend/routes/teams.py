"""Team Challenge Leaderboard endpoints (F25)."""

from __future__ import annotations

import logging
import secrets
import uuid
from collections import Counter
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateTeamRequest(BaseModel):
    name: str
    creator_url_hash: str
    creator_display_name: str
    creator_score: int = 0
    creator_role_category: str = ""


class JoinTeamRequest(BaseModel):
    url_hash: str
    display_name: str
    score: int = 0
    role_category: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_db():
    """Return session factory or raise 503."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        raise HTTPException(status_code=503, detail="Database not available.")
    return _session_factory


def _generate_invite_code(length: int = 8) -> str:
    """Generate a URL-safe random invite code."""
    return secrets.token_urlsafe(length)[:length].upper()


def _member_to_dict(m: Any) -> Dict[str, Any]:
    return {
        "id": str(m.id),
        "url_hash": m.url_hash,
        "display_name": m.display_name,
        "score": m.score,
        "role_category": m.role_category or "",
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


# ---------------------------------------------------------------------------
# POST /api/teams — create a new team
# ---------------------------------------------------------------------------

@router.post("/api/teams")
async def create_team(payload: CreateTeamRequest) -> JSONResponse:
    """Create a new team and add the creator as the first member."""
    factory = _require_db()

    from db_models import Team, TeamMember

    team_id = uuid.uuid4()
    invite_code = _generate_invite_code()

    team = Team(
        id=team_id,
        name=payload.name[:200],
        created_by_url_hash=payload.creator_url_hash,
        invite_code=invite_code,
    )

    member = TeamMember(
        id=uuid.uuid4(),
        team_id=team_id,
        url_hash=payload.creator_url_hash,
        display_name=payload.creator_display_name[:200],
        score=payload.creator_score,
        role_category=(payload.creator_role_category or "")[:100],
    )

    try:
        async with factory() as session:
            session.add(team)
            session.add(member)
            await session.commit()
    except Exception:
        logger.exception("Failed to create team")
        raise HTTPException(status_code=500, detail="Failed to create team.")

    logger.info("Team created", extra={"team_id": str(team_id), "invite_code": invite_code})

    return JSONResponse({
        "status": "ok",
        "team": {
            "id": str(team_id),
            "name": payload.name[:200],
            "invite_code": invite_code,
            "created_at": team.created_at.isoformat() if team.created_at else None,
        },
        "member": _member_to_dict(member),
    })


# ---------------------------------------------------------------------------
# POST /api/teams/{code}/join — join an existing team
# ---------------------------------------------------------------------------

@router.post("/api/teams/{code}/join")
async def join_team(code: str, payload: JoinTeamRequest) -> JSONResponse:
    """Join an existing team by invite code."""
    factory = _require_db()

    from sqlalchemy import select
    from db_models import Team, TeamMember

    async with factory() as session:
        # Find team
        stmt = select(Team).where(Team.invite_code == code.upper())
        team = (await session.execute(stmt)).scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")

        # Check if already a member
        existing_stmt = (
            select(TeamMember)
            .where(TeamMember.team_id == team.id)
            .where(TeamMember.url_hash == payload.url_hash)
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            # Update score if they rejoin
            existing.score = payload.score
            existing.display_name = payload.display_name[:200]
            await session.commit()
            return JSONResponse({
                "status": "ok",
                "team": {
                    "id": str(team.id),
                    "name": team.name,
                    "invite_code": team.invite_code,
                },
                "member": _member_to_dict(existing),
                "already_member": True,
            })

        member = TeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            url_hash=payload.url_hash,
            display_name=payload.display_name[:200],
            score=payload.score,
            role_category=(payload.role_category or "")[:100],
        )
        session.add(member)
        await session.commit()

    logger.info("Member joined team", extra={"team": code, "url_hash": payload.url_hash})

    return JSONResponse({
        "status": "ok",
        "team": {
            "id": str(team.id),
            "name": team.name,
            "invite_code": team.invite_code,
        },
        "member": _member_to_dict(member),
    })


# ---------------------------------------------------------------------------
# GET /api/teams/{code}/leaderboard — ranked members
# ---------------------------------------------------------------------------

@router.get("/api/teams/{code}/leaderboard")
async def team_leaderboard(code: str) -> JSONResponse:
    """Return team members sorted by score descending with aggregate stats."""
    factory = _require_db()

    from sqlalchemy import select, func
    from db_models import Team, TeamMember

    async with factory() as session:
        stmt = select(Team).where(Team.invite_code == code.upper())
        team = (await session.execute(stmt)).scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")

        members_stmt = (
            select(TeamMember)
            .where(TeamMember.team_id == team.id)
            .order_by(TeamMember.score.desc())
        )
        members = (await session.execute(members_stmt)).scalars().all()

        member_list = [_member_to_dict(m) for m in members]

        # Aggregate stats
        scores = [m.score for m in members]
        avg_score = round(sum(scores) / len(scores)) if scores else 0
        count = len(scores)
        top_score = max(scores) if scores else 0
        bottom_score = min(scores) if scores else 0

    return JSONResponse({
        "status": "ok",
        "team_name": team.name,
        "invite_code": team.invite_code,
        "members": member_list,
        "stats": {
            "avg_score": avg_score,
            "count": count,
            "top_score": top_score,
            "bottom_score": bottom_score,
            "score_gap": top_score - bottom_score,
        },
    })


# ---------------------------------------------------------------------------
# GET /api/teams/{code}/insights — aggregate team analytics
# ---------------------------------------------------------------------------

@router.get("/api/teams/{code}/insights")
async def team_insights(code: str) -> JSONResponse:
    """Return aggregate insights for a team."""
    factory = _require_db()

    from sqlalchemy import select
    from db_models import Team, TeamMember

    async with factory() as session:
        stmt = select(Team).where(Team.invite_code == code.upper())
        team = (await session.execute(stmt)).scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")

        members_stmt = (
            select(TeamMember)
            .where(TeamMember.team_id == team.id)
            .order_by(TeamMember.score.desc())
        )
        members = (await session.execute(members_stmt)).scalars().all()

    scores = [m.score for m in members]
    count = len(scores)
    avg_score = round(sum(scores) / count) if count else 0

    # Score distribution buckets (0-20, 21-40, 41-60, 61-80, 81-100)
    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in scores:
        if s <= 20:
            buckets["0-20"] += 1
        elif s <= 40:
            buckets["21-40"] += 1
        elif s <= 60:
            buckets["41-60"] += 1
        elif s <= 80:
            buckets["61-80"] += 1
        else:
            buckets["81-100"] += 1

    # Role category distribution
    role_counts: Dict[str, int] = {}
    for m in members:
        cat = m.role_category or "Unknown"
        role_counts[cat] = role_counts.get(cat, 0) + 1

    # Common strengths / gaps (based on score thresholds)
    strengths = [m.display_name for m in members if m.score >= 70]
    gaps = [m.display_name for m in members if m.score < 40]

    return JSONResponse({
        "status": "ok",
        "team_name": team.name,
        "avg_score": avg_score,
        "member_count": count,
        "score_distribution": buckets,
        "role_distribution": role_counts,
        "high_performers": strengths[:5],
        "needs_attention": gaps[:5],
    })
