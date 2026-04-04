"""Report and certificate generation endpoints (F29, F26)."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reports"])


async def _get_run_result(run_id: str) -> dict:
    """Fetch pipeline_run result JSON from database by ID."""
    from db import db_available, _session_factory

    if not db_available() or not _session_factory:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Cannot generate report.",
        )

    try:
        run_uuid = UUID(run_id)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid run ID format.") from exc

    try:
        from sqlalchemy import select
        from db_models import PipelineRun

        async with _session_factory() as session:
            stmt = select(PipelineRun).where(PipelineRun.id == run_uuid)
            run = (await session.execute(stmt)).scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Pipeline run not found.")

        result = run.result
        if not result or not isinstance(result, dict):
            raise HTTPException(
                status_code=404,
                detail="No result data available for this run.",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch pipeline run %s", run_id)
        raise HTTPException(status_code=500, detail="Internal error fetching run data.") from exc


@router.get("/api/reports/{run_id}/pdf")
async def download_pdf_report(run_id: str) -> Response:
    """Generate and download a PDF assessment report for a pipeline run."""
    result = await _get_run_result(run_id)

    try:
        from services.pdf_service import generate_pdf_report

        pdf_bytes = generate_pdf_report(result)
    except Exception as exc:
        logger.exception("PDF generation failed for run %s", run_id)
        raise HTTPException(status_code=500, detail="PDF generation failed.") from exc

    name = (result.get("name") or "assessment").replace(" ", "_")
    filename = f"AI_Resilience_Report_{name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/certificates/{run_id}")
async def download_certificate(run_id: str) -> Response:
    """Generate and download a PNG certificate for a pipeline run."""
    result = await _get_run_result(run_id)

    try:
        from services.certificate_service import generate_certificate

        png_bytes = generate_certificate(result)
    except Exception as exc:
        logger.exception("Certificate generation failed for run %s", run_id)
        raise HTTPException(status_code=500, detail="Certificate generation failed.") from exc

    name = (result.get("name") or "certificate").replace(" ", "_")
    filename = f"AI_Resilience_Certificate_{name}.png"

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
