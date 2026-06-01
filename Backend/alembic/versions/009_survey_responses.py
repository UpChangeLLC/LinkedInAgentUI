"""Add survey_responses table (onboarding survey persistence, spec 01 §8.3).

Revision ID: 009
Revises: 008
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "009"
down_revision = "008"


def upgrade() -> None:
    op.create_table(
        "survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("url_hash", sa.String(length=64), nullable=True),
        sa.Column("responses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", name="uq_survey_responses_run_id"),
    )
    op.create_index("ix_survey_responses_user_signup_id", "survey_responses", ["user_signup_id"])
    op.create_index("ix_survey_responses_url_hash", "survey_responses", ["url_hash"])
    op.create_index("ix_survey_responses_created_at", "survey_responses", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_survey_responses_created_at", table_name="survey_responses")
    op.drop_index("ix_survey_responses_url_hash", table_name="survey_responses")
    op.drop_index("ix_survey_responses_user_signup_id", table_name="survey_responses")
    op.drop_table("survey_responses")
