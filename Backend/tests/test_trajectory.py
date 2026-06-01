"""Tests for services.trajectory — history -> trajectory transform (Workstream D)."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _row(created_at, resilience, readiness=None, dims=None, run_id="r"):
    return {
        "run_id": run_id,
        "created_at": created_at,
        "resilience_score": resilience,
        "readiness_score": readiness if readiness is not None else resilience,
        "dimension_scores": dims or {},
    }


class TestBuildTrajectory:
    def test_empty(self):
        from services.trajectory import build_trajectory

        assert build_trajectory([]) == []

    def test_single_entry_has_null_delta(self):
        from services.trajectory import build_trajectory

        out = build_trajectory([_row(datetime(2026, 4, 1, tzinfo=timezone.utc), 68)])
        assert len(out) == 1
        assert out[0]["delta_from_previous"] is None
        assert out[0]["top_change_dim"] is None
        assert out[0]["resilience_score"] == 68

    def test_delta_computed_between_entries(self):
        from services.trajectory import build_trajectory

        rows = [
            _row(datetime(2026, 4, 1, tzinfo=timezone.utc), 68),
            _row(datetime(2026, 5, 1, tzinfo=timezone.utc), 74),
        ]
        out = build_trajectory(rows)
        assert out[1]["delta_from_previous"] == 6

    def test_top_change_dim_is_largest_abs_delta(self):
        from services.trajectory import build_trajectory

        rows = [
            _row(datetime(2026, 4, 1, tzinfo=timezone.utc), 68,
                 dims={"ai_fluency": {"score": 5.0}, "learning_velocity": {"score": 4.0}}),
            _row(datetime(2026, 5, 1, tzinfo=timezone.utc), 74,
                 dims={"ai_fluency": {"score": 5.2}, "learning_velocity": {"score": 6.5}}),
        ]
        out = build_trajectory(rows)
        assert out[1]["top_change_dim"] == "learning_velocity"

    def test_handles_numeric_dim_values(self):
        from services.trajectory import build_trajectory

        rows = [
            _row(datetime(2026, 4, 1, tzinfo=timezone.utc), 68, dims={"ai_fluency": 5.0}),
            _row(datetime(2026, 5, 1, tzinfo=timezone.utc), 70, dims={"ai_fluency": 6.0}),
        ]
        out = build_trajectory(rows)
        assert out[1]["top_change_dim"] == "ai_fluency"

    def test_computed_at_is_iso_string(self):
        from services.trajectory import build_trajectory

        out = build_trajectory([_row(datetime(2026, 4, 1, tzinfo=timezone.utc), 68)])
        assert isinstance(out[0]["computed_at"], str)
        assert out[0]["computed_at"].startswith("2026-04-01")


class TestComputeNextRerun:
    def test_none_when_no_last(self):
        from services.trajectory import compute_next_rerun

        assert compute_next_rerun(None) is None

    def test_adds_gate_days(self):
        from services.trajectory import compute_next_rerun

        last = datetime(2026, 5, 1, tzinfo=timezone.utc)
        nxt = compute_next_rerun(last, gate_days=30)
        assert nxt == (last + timedelta(days=30)).isoformat()
