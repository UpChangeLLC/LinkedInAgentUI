"""Tests for services.cohort — cohort distribution + percentile (Workstream D, Loop 2)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestPercentileOf:
    def test_empty(self):
        from services.cohort import percentile_of

        assert percentile_of([], 50) == 0

    def test_middle(self):
        from services.cohort import percentile_of

        # 2 of 5 scores are below 30 -> 40th percentile
        assert percentile_of([10, 20, 30, 40, 50], 30) == 40

    def test_top(self):
        from services.cohort import percentile_of

        assert percentile_of([10, 20, 30, 40, 50], 50) == 80

    def test_bottom(self):
        from services.cohort import percentile_of

        assert percentile_of([10, 20, 30], 10) == 0


class TestBuildCohort:
    def test_empty_is_forming(self):
        from services.cohort import build_cohort

        out = build_cohort([], 50, min_size=50)
        assert out["forming"] is True
        assert out["cohort_size"] == 0
        assert out["distribution"] == []

    def test_below_min_size_is_forming(self):
        from services.cohort import build_cohort

        out = build_cohort([10, 20, 30], 20, min_size=50)
        assert out["forming"] is True
        assert out["cohort_size"] == 3

    def test_distribution_and_percentile(self):
        from services.cohort import build_cohort

        scores = list(range(0, 100))  # 100 scores 0..99
        out = build_cohort(scores, 74, min_size=50)
        assert out["forming"] is False
        assert out["cohort_size"] == 100
        assert out["user_percentile"] == 74
        # 20 buckets of width 5
        assert len(out["distribution"]) == 20
        assert sum(b["count"] for b in out["distribution"]) == 100
