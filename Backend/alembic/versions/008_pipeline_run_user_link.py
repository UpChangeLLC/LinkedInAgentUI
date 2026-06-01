"""Link pipeline_runs to user_signups (v1 hard auth gate).

Revision ID: 008
Revises: 007
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "008"
down_revision = "007"


def upgrade() -> None:
    op.add_column(
        "pipeline_runs",
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_pipeline_runs_user_signup_id",
        "pipeline_runs",
        "user_signups",
        ["user_signup_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_pipeline_runs_user_signup_id", "pipeline_runs", ["user_signup_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_pipeline_runs_user_signup_id", table_name="pipeline_runs")
    op.drop_constraint(
        "fk_pipeline_runs_user_signup_id", "pipeline_runs", type_="foreignkey"
    )
    op.drop_column("pipeline_runs", "user_signup_id")
