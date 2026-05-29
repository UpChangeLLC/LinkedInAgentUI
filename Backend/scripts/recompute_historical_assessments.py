"""Backfill `resilience_score` / `readiness_score` / `is_v0_legacy` on
existing rows in ``assessment_history`` (Workstream B, spec 00 §7.5 + plan
§Sequencing wk12).

Why this script exists
----------------------
The v1 ML platform writes `resilience_score` and `readiness_score` per
assessment. Before migration 010, those columns didn't exist; older runs only
have `score` and `dimension_scores`. The dashboard now reads the new fields
first, so rows pre-dating migration 010 show null on the trajectory chart.

This script does an additive v0 backfill — the same mapping the live
`ml_client._score_v0()` does for new runs:

  * resilience_score := readiness_score := score        (additive, lossless)
  * legacy_score          := score                       (preserves provenance)
  * legacy_dimension_scores := dimension_scores
  * is_v0_legacy           := True
  * recomputed_at          := now()
  * shap_attribution       := []  (v0 has no SHAP)

Idempotent: rows where `recomputed_at IS NOT NULL` are skipped. Safe to re-run.

Spec 00 caps the cost at ~$200. Because this is pure SQL with no LLM calls,
the actual cost is negligible — the $200 ceiling is the doc 00 ceiling for the
v1 cutover *if* we ever needed to re-run the LLM pipeline. We don't here.

Usage
-----
    docker compose exec app python -m scripts.recompute_historical_assessments
    docker compose exec app python -m scripts.recompute_historical_assessments --dry-run
    docker compose exec app python -m scripts.recompute_historical_assessments --limit 500
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("recompute_historical_assessments")


async def recompute(limit: Optional[int] = None, dry_run: bool = False) -> int:
    """Backfill v0-legacy rows. Returns the number of rows updated."""
    from db import db_available, init_db  # noqa: WPS433 (runtime import)

    # Stand-alone CLI: the FastAPI lifespan that normally calls init_db hasn't
    # run. Initialize the engine pool here before touching the session factory.
    await init_db()
    import db as _db_mod  # noqa: WPS433

    if not db_available() or _db_mod._session_factory is None:
        print("DATABASE_URL not configured — nothing to do.", file=sys.stderr)
        return 0
    session_factory = _db_mod._session_factory

    from sqlalchemy import select
    from db_models import AssessmentHistory

    updated = 0
    skipped = 0

    async with session_factory() as session:
        stmt = (
            select(AssessmentHistory)
            .where(AssessmentHistory.recomputed_at.is_(None))
            .order_by(AssessmentHistory.id)
        )
        if limit is not None:
            stmt = stmt.limit(limit)

        rows = (await session.execute(stmt)).scalars().all()
        now = datetime.now(timezone.utc)

        for row in rows:
            # If resilience+readiness are *already* populated and just `recomputed_at`
            # is null (e.g. a forward-migrated row), don't overwrite real values —
            # only stamp the metadata.
            already_v1 = (
                row.resilience_score is not None
                and row.readiness_score is not None
            )
            if not already_v1:
                row.resilience_score = row.score
                row.readiness_score = row.score
                if row.shap_attribution is None:
                    row.shap_attribution = []
                if row.legacy_score is None:
                    row.legacy_score = row.score
                if row.legacy_dimension_scores is None and row.dimension_scores is not None:
                    row.legacy_dimension_scores = row.dimension_scores
            row.is_v0_legacy = not already_v1
            row.recomputed_at = now
            updated += 1

        if dry_run:
            await session.rollback()
            print(f"[dry-run] would update {updated} rows ({skipped} skipped).")
        else:
            await session.commit()
            print(f"updated {updated} rows ({skipped} skipped).")

    return updated


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Cap rows per run.")
    parser.add_argument("--dry-run", action="store_true", help="Roll back instead of committing.")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    n = asyncio.run(recompute(limit=args.limit, dry_run=args.dry_run))
    return 0 if n >= 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
