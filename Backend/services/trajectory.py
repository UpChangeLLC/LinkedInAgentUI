"""Transform assessment history into a score trajectory (Workstream D).

Pure functions — no DB — so they're trivially testable and reusable by the
retention route. Each entry gains the resilience delta vs. the previous run and
the dimension that moved most, which drives the "+6 points, mostly from learning
velocity" caption on the trajectory chart (spec 03 §3.1).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _dim_score(value: Any) -> Optional[float]:
    """A dim entry is either a number or a dict with a 'score' key."""
    if isinstance(value, dict):
        v = value.get("score")
        return float(v) if isinstance(v, (int, float)) else None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _top_change_dim(prev: Dict[str, Any], cur: Dict[str, Any]) -> Optional[str]:
    best_dim: Optional[str] = None
    best_delta = -1.0
    for dim, cur_val in (cur or {}).items():
        cs = _dim_score(cur_val)
        ps = _dim_score((prev or {}).get(dim))
        if cs is None or ps is None:
            continue
        delta = abs(cs - ps)
        if delta > best_delta:
            best_delta = delta
            best_dim = dim
    return best_dim if best_delta > 0 else None


def build_trajectory(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rows ascending by created_at -> trajectory entries with deltas."""
    entries: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        prev = rows[i - 1] if i > 0 else None
        resilience = row.get("resilience_score")
        delta = None
        top_dim = None
        if prev is not None and resilience is not None and prev.get("resilience_score") is not None:
            delta = int(round(resilience - prev["resilience_score"]))
            top_dim = _top_change_dim(prev.get("dimension_scores", {}), row.get("dimension_scores", {}))
        entries.append(
            {
                "run_id": str(row.get("run_id")) if row.get("run_id") is not None else None,
                "computed_at": _iso(row.get("created_at")),
                "resilience_score": resilience,
                "readiness_score": row.get("readiness_score"),
                "delta_from_previous": delta,
                "top_change_dim": top_dim,
            }
        )
    return entries


def compute_next_rerun(last_created_at: Optional[datetime], gate_days: int = 30) -> Optional[str]:
    """ISO timestamp when the next free re-run unlocks, or None if no prior run."""
    if not last_created_at:
        return None
    return (last_created_at + timedelta(days=gate_days)).isoformat()
