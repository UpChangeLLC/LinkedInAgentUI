"""Action item CRUD endpoints (F24 — Personalized Action Tracker)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from models import ActionItemSchema, ActionItemUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_db():
    """Return session factory or raise 503."""
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        raise HTTPException(status_code=503, detail="Database not available.")
    return _session_factory


# ---------------------------------------------------------------------------
# GET /api/actions/{url_hash} — list actions for a profile
# ---------------------------------------------------------------------------

@router.get("/api/actions/{url_hash}")
async def list_actions(url_hash: str) -> JSONResponse:
    """Return all action items for a given URL hash."""
    factory = _require_db()

    from sqlalchemy import select
    from db_models import ActionItem

    async with factory() as session:
        stmt = (
            select(ActionItem)
            .where(ActionItem.url_hash == url_hash)
            .order_by(ActionItem.created_at.asc())
        )
        rows = (await session.execute(stmt)).scalars().all()

        items = [
            {
                "id": str(r.id),
                "title": r.title,
                "description": r.description or "",
                "category": r.category,
                "priority": r.priority or "medium",
                "estimated_hours": r.estimated_hours or 0,
                "resource_url": r.resource_url or "",
                "resource_title": r.resource_title or "",
                "status": r.status,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    return JSONResponse({"status": "ok", "actions": items})


# ---------------------------------------------------------------------------
# GET /api/actions/{url_hash}/progress — completion stats
# ---------------------------------------------------------------------------

@router.get("/api/actions/{url_hash}/progress")
async def action_progress(url_hash: str) -> JSONResponse:
    """Return progress stats for action items."""
    factory = _require_db()

    from sqlalchemy import func, select
    from db_models import ActionItem

    async with factory() as session:
        total_stmt = select(func.count()).where(ActionItem.url_hash == url_hash)
        total = (await session.execute(total_stmt)).scalar() or 0

        done_stmt = (
            select(func.count())
            .where(ActionItem.url_hash == url_hash)
            .where(ActionItem.status == "completed")
        )
        completed = (await session.execute(done_stmt)).scalar() or 0

        in_progress_stmt = (
            select(func.count())
            .where(ActionItem.url_hash == url_hash)
            .where(ActionItem.status == "in_progress")
        )
        in_progress = (await session.execute(in_progress_stmt)).scalar() or 0

    pct = round((completed / total) * 100) if total > 0 else 0
    return JSONResponse({
        "total": total,
        "completed": completed,
        "in_progress": in_progress,
        "pending": total - completed - in_progress,
        "completion_percentage": pct,
    })


# ---------------------------------------------------------------------------
# PATCH /api/actions/{action_id} — update action status
# ---------------------------------------------------------------------------

@router.patch("/api/actions/{action_id}")
async def update_action(action_id: str, payload: ActionItemUpdate) -> JSONResponse:
    """Update an action item (status, completion)."""
    factory = _require_db()

    from sqlalchemy import select
    from db_models import ActionItem

    try:
        uid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action ID format.")

    async with factory() as session:
        stmt = select(ActionItem).where(ActionItem.id == uid)
        result = await session.execute(stmt)
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(status_code=404, detail="Action item not found.")

        if payload.status is not None:
            valid_statuses = {"pending", "in_progress", "completed"}
            if payload.status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
            item.status = payload.status
            if payload.status == "completed" and not item.completed_at:
                item.completed_at = datetime.now(timezone.utc)
            elif payload.status != "completed":
                item.completed_at = None

        await session.commit()

    return JSONResponse({"status": "ok", "action_id": action_id})


# ---------------------------------------------------------------------------
# Helper: store action items from analysis result
# ---------------------------------------------------------------------------

async def store_action_items(
    url_hash: str,
    action_items: list,
    pipeline_run_id: Optional[uuid.UUID] = None,
    profile_id: Optional[uuid.UUID] = None,
) -> None:
    """Persist generated action items to DB. Fire-and-forget; never raises.

    Deduplicates by deleting old 'pending' items for the same url_hash
    before inserting. Items marked 'in_progress' or 'completed' by the
    user are preserved.
    """
    from db import db_available, _session_factory
    if not db_available() or not _session_factory:
        return

    try:
        from sqlalchemy import delete
        from db_models import ActionItem

        async with _session_factory() as session:
            # Remove old pending items to avoid duplicates on re-analysis
            await session.execute(
                delete(ActionItem).where(
                    ActionItem.url_hash == url_hash,
                    ActionItem.status == "pending",
                )
            )

            for item_data in action_items:
                if not isinstance(item_data, dict):
                    continue
                action = ActionItem(
                    id=uuid.uuid4(),
                    url_hash=url_hash,
                    title=str(item_data.get("title", ""))[:500],
                    description=str(item_data.get("description", "")),
                    category=str(item_data.get("category", "learning"))[:50],
                    priority=str(item_data.get("priority", "medium"))[:20],
                    estimated_hours=int(item_data.get("estimated_hours", 0) or 0),
                    resource_url=str(item_data.get("resource_url", ""))[:2000],
                    resource_title=str(item_data.get("resource_title", ""))[:500],
                    status="pending",
                    pipeline_run_id=pipeline_run_id,
                    profile_id=profile_id,
                )
                session.add(action)
            await session.commit()
    except Exception:
        logger.warning("Failed to store action items", exc_info=True)
