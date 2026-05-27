"""Add Resilience Score v1 columns to assessment_history.

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "010"
down_revision = "009"


def upgrade() -> None:
    op.add_column("assessment_history", sa.Column("resilience_score", sa.Integer(), nullable=True))
    op.add_column("assessment_history", sa.Column("readiness_score", sa.Integer(), nullable=True))
    op.add_column(
        "assessment_history",
        sa.Column("shap_attribution", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "assessment_history",
        sa.Column("is_v0_legacy", sa.Boolean(), server_default=sa.false(), nullable=True),
    )
    op.add_column("assessment_history", sa.Column("recomputed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assessment_history", sa.Column("legacy_score", sa.Integer(), nullable=True))
    op.add_column(
        "assessment_history",
        sa.Column("legacy_dimension_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("assessment_history", "legacy_dimension_scores")
    op.drop_column("assessment_history", "legacy_score")
    op.drop_column("assessment_history", "recomputed_at")
    op.drop_column("assessment_history", "is_v0_legacy")
    op.drop_column("assessment_history", "shap_attribution")
    op.drop_column("assessment_history", "readiness_score")
    op.drop_column("assessment_history", "resilience_score")
