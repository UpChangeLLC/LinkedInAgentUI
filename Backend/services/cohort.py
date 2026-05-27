"""Cohort distribution + percentile (Workstream D, Loop 2 — social proof).

Pure functions over a list of peer scores, so the retention route can stay thin
and these are unit-tested without a DB. Cohorts below ``min_size`` are reported
as "forming" to protect privacy and avoid noisy small-n distributions
(spec 03 §3.2.5).
"""

from __future__ import annotations

from typing import Any, Dict, List

BUCKET_WIDTH = 5
NUM_BUCKETS = 20  # 0-4, 5-9, ... 95-100


def percentile_of(scores: List[float], user_score: float) -> int:
    """Percent of the cohort strictly below the user's score (0-100)."""
    if not scores:
        return 0
    below = sum(1 for s in scores if s < user_score)
    return int(round(100 * below / len(scores)))


def _distribution(scores: List[float]) -> List[Dict[str, int]]:
    buckets = [0] * NUM_BUCKETS
    for s in scores:
        idx = min(int(s) // BUCKET_WIDTH, NUM_BUCKETS - 1)
        idx = max(idx, 0)
        buckets[idx] += 1
    return [{"bucket": i * BUCKET_WIDTH, "count": c} for i, c in enumerate(buckets)]


def build_cohort(scores: List[float], user_score: float, min_size: int = 50) -> Dict[str, Any]:
    """Cohort summary: size, user percentile, and a 20-bucket histogram."""
    size = len(scores)
    if size < min_size:
        return {
            "forming": True,
            "cohort_size": size,
            "user_percentile": percentile_of(scores, user_score) if scores else 0,
            "distribution": [],
        }
    return {
        "forming": False,
        "cohort_size": size,
        "user_percentile": percentile_of(scores, user_score),
        "distribution": _distribution(scores),
    }
