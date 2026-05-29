"""Add ml_inference_log table (orchestrator-side audit of scoring calls).

The ML platform is stateless; the orchestrator writes one row here after each
score (or v0 fall-through) so we can audit model provenance and watch the v1
fall-through rate during cutover.

Revision ID: 014
Revises: 013
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "014"
down_revision = "013"


def upgrade() -> None:
    op.create_table(
        "ml_inference_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scoring_version", sa.String(length=10), nullable=False, server_default="v0"),
        sa.Column("model_version", sa.String(length=100), nullable=True),
        sa.Column("onet_version", sa.String(length=100), nullable=True),
        sa.Column("platform_attempted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fell_back", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("resilience_score", sa.Integer(), nullable=True),
        sa.Column("readiness_score", sa.Integer(), nullable=True),
        sa.Column("shap_attribution", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["pipeline_run_id"], ["pipeline_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ml_inference_log_pipeline_run_id", "ml_inference_log", ["pipeline_run_id"])
    op.create_index("ix_ml_inference_log_user_signup_id", "ml_inference_log", ["user_signup_id"])
    op.create_index("idx_ml_inference_log_version_created", "ml_inference_log", ["scoring_version", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_ml_inference_log_version_created", table_name="ml_inference_log")
    op.drop_index("ix_ml_inference_log_user_signup_id", table_name="ml_inference_log")
    op.drop_index("ix_ml_inference_log_pipeline_run_id", table_name="ml_inference_log")
    op.drop_table("ml_inference_log")
