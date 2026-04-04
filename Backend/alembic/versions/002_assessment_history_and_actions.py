"""Add assessment_history and action_items tables (F22 + F24).

Revision ID: 002
Revises: 001
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AssessmentHistory — score tracking per URL
    op.create_table(
        "assessment_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("url_hash", sa.String(64), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("dimension_scores", JSONB, nullable=True),
        sa.Column("risk_band", sa.String(100), nullable=True),
        sa.Column(
            "pipeline_run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_assessment_history_url_hash", "assessment_history", ["url_hash"])
    op.create_index("idx_assessment_history_created_at", "assessment_history", ["created_at"])
    op.create_index(
        "idx_assessment_history_url_created",
        "assessment_history",
        ["url_hash", "created_at"],
    )

    # ActionItem — personalized action tracker
    op.create_table(
        "action_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("url_hash", sa.String(64), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=True),
        sa.Column("estimated_hours", sa.Integer(), nullable=True),
        sa.Column("resource_url", sa.String(2000), nullable=True),
        sa.Column("resource_title", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "pipeline_run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_action_items_url_hash", "action_items", ["url_hash"])
    op.create_index("idx_action_items_url_status", "action_items", ["url_hash", "status"])


def downgrade() -> None:
    op.drop_table("action_items")
    op.drop_table("assessment_history")
