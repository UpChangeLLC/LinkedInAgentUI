"""PDF report generation using ReportLab platypus."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# LinkedIn blue
_LINKEDIN_BLUE = colors.HexColor("#0077B5")
_LIGHT_BLUE = colors.HexColor("#E8F4FD")
_DARK_TEXT = colors.HexColor("#1D2226")
_GRAY_TEXT = colors.HexColor("#666666")


def _styles() -> Dict[str, ParagraphStyle]:
    """Build custom paragraph styles."""
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "CustomTitle",
            parent=base["Title"],
            fontSize=24,
            textColor=colors.white,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "CustomSubtitle",
            parent=base["Normal"],
            fontSize=12,
            textColor=colors.white,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "heading": ParagraphStyle(
            "CustomHeading",
            parent=base["Heading2"],
            fontSize=14,
            textColor=_LINKEDIN_BLUE,
            spaceBefore=16,
            spaceAfter=8,
            borderPadding=4,
        ),
        "body": ParagraphStyle(
            "CustomBody",
            parent=base["Normal"],
            fontSize=10,
            textColor=_DARK_TEXT,
            leading=14,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "SmallText",
            parent=base["Normal"],
            fontSize=8,
            textColor=_GRAY_TEXT,
            alignment=TA_CENTER,
        ),
        "score_big": ParagraphStyle(
            "ScoreBig",
            parent=base["Title"],
            fontSize=48,
            textColor=_LINKEDIN_BLUE,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "score_label": ParagraphStyle(
            "ScoreLabel",
            parent=base["Normal"],
            fontSize=12,
            textColor=_GRAY_TEXT,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "bullet": ParagraphStyle(
            "BulletItem",
            parent=base["Normal"],
            fontSize=10,
            textColor=_DARK_TEXT,
            leading=14,
            leftIndent=20,
            spaceAfter=4,
        ),
    }


def _header_block(name: str, title: str, date_str: str, styles: dict) -> List:
    """Build the blue header block with name, title, date."""
    header_data = [
        [Paragraph("AI Resilience Score Report", styles["title"])],
        [Paragraph(f"{name} &mdash; {title}", styles["subtitle"])],
        [Paragraph(f"Generated {date_str}", styles["subtitle"])],
    ]
    header_table = Table(header_data, colWidths=[6.5 * inch])
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _LINKEDIN_BLUE),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 20),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 16),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]
        )
    )
    return [header_table, Spacer(1, 16)]


def _dimension_table(dim_scores: Dict[str, Any], styles: dict) -> List:
    """Render dimension scores as a table."""
    rows = [["Dimension", "Score", "Rating"]]
    for dim_name, dim_val in dim_scores.items():
        if isinstance(dim_val, dict):
            score = dim_val.get("score", 0)
            label = dim_val.get("label", dim_name)
        else:
            score = dim_val
            label = dim_name
        # Convert 1-5 scale to display
        display_name = label.replace("_", " ").title()
        rating = "Strong" if score >= 4 else ("Moderate" if score >= 3 else "Needs Improvement")
        rows.append([display_name, f"{score}/5", rating])

    if len(rows) <= 1:
        return []

    table = Table(rows, colWidths=[3 * inch, 1.5 * inch, 2 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _LINKEDIN_BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("ALIGN", (2, 0), (2, -1), "CENTER"),
                ("BACKGROUND", (0, 1), (-1, -1), _LIGHT_BLUE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LIGHT_BLUE]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return [
        Paragraph("Dimension Scores", styles["heading"]),
        table,
        Spacer(1, 12),
    ]


def _bullet_list(items: List[str], heading: str, styles: dict) -> List:
    """Render a list of items with bullets."""
    if not items:
        return []
    elements = [Paragraph(heading, styles["heading"])]
    for item in items:
        elements.append(Paragraph(f"&#8226; {item}", styles["bullet"]))
    elements.append(Spacer(1, 8))
    return elements


def generate_pdf_report(result: dict) -> bytes:
    """Generate a professional PDF report from assessment results.

    Args:
        result: The pipeline result dict (stored in pipeline_runs.result JSONB).

    Returns:
        PDF file content as bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    s = _styles()
    elements: List = []

    # Extract data
    name = result.get("name", "Assessment Subject")
    title = result.get("title", result.get("benchmark_role", ""))
    overall = result.get("overall_assessment", {}) or {}
    score = result.get("profile_score", 0)
    risk_band = overall.get("ai_readiness", result.get("risk_band", ""))
    dim_scores = result.get("dimension_scores", {}) or {}
    executive_summary = result.get("executive_summary", "")
    company = result.get("company", "")
    industry = result.get("industry", "")
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")

    # --- Header ---
    elements.extend(_header_block(name, title, date_str, s))

    # --- Composite Score ---
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(str(int(score)), s["score_big"]))
    elements.append(Paragraph(f"AI Resilience Score &mdash; {risk_band}", s["score_label"]))
    if company or industry:
        elements.append(Paragraph(f"{company} | {industry}", s["score_label"]))
    elements.append(Spacer(1, 8))

    # --- Executive Summary ---
    if executive_summary:
        elements.append(Paragraph("Executive Summary", s["heading"]))
        elements.append(Paragraph(executive_summary, s["body"]))
        elements.append(Spacer(1, 8))

    # --- Dimension Scores Table ---
    elements.extend(_dimension_table(dim_scores, s))

    # --- Top Strengths ---
    strengths = []
    risk_data = result.get("ai_risk_assessment", {}) or {}
    for item in (risk_data.get("key_strengths", []) or [])[:3]:
        if isinstance(item, dict):
            strengths.append(f"<b>{item.get('title', '')}</b>: {item.get('detail', '')}")
        elif isinstance(item, str):
            strengths.append(item)
    elements.extend(_bullet_list(strengths, "Top Strengths", s))

    # --- Top Gaps ---
    gaps = []
    for item in (risk_data.get("vulnerabilities", []) or [])[:3]:
        if isinstance(item, dict):
            gaps.append(f"<b>{item.get('title', '')}</b>: {item.get('detail', '')}")
        elif isinstance(item, str):
            gaps.append(item)
    elements.extend(_bullet_list(gaps, "Top Gaps", s))

    # --- Recommended Actions ---
    actions = []
    for item in (result.get("action_items", []) or [])[:5]:
        if isinstance(item, dict):
            cat = item.get("category", "")
            prio = item.get("priority", "")
            actions.append(
                f"<b>[{prio.upper()}]</b> {item.get('title', '')} ({cat})"
            )
        elif isinstance(item, str):
            actions.append(item)
    elements.extend(_bullet_list(actions, "Recommended Actions (Top 5)", s))

    # --- Peer Comparison Summary ---
    peer = result.get("peer_comparison", {}) or {}
    if peer:
        elements.append(Paragraph("Peer Comparison", s["heading"]))
        percentile = peer.get("percentile", "")
        if percentile:
            elements.append(
                Paragraph(
                    f"You rank in the <b>{percentile}th percentile</b> among peers in your industry.",
                    s["body"],
                )
            )
        industry_avg = peer.get("industry_avg_score", "")
        if industry_avg:
            elements.append(
                Paragraph(f"Industry average score: <b>{industry_avg}</b>", s["body"])
            )
        elements.append(Spacer(1, 8))

    # --- Footer ---
    elements.append(Spacer(1, 24))
    elements.append(
        Paragraph(
            "This report was generated by the AI Resilience Score platform. "
            "Scores are based on publicly available profile data and AI analysis.",
            s["small"],
        )
    )

    doc.build(elements)
    return buf.getvalue()
