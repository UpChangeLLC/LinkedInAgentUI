"""Add email_queue table (Postgres-backed transactional email queue).

Revision ID: 013
Revises: 012
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "013"
down_revision = "012"


def upgrade() -> None:
    op.create_table(
        "email_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template", sa.String(length=100), nullable=False),
        sa.Column("model", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("message_stream", sa.String(length=50), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_queue_user_signup_id", "email_queue", ["user_signup_id"])
    op.create_index("ix_email_queue_scheduled_for", "email_queue", ["scheduled_for"])
    op.create_index("idx_email_queue_status_scheduled", "email_queue", ["status", "scheduled_for"])


def downgrade() -> None:
    op.drop_index("idx_email_queue_status_scheduled", table_name="email_queue")
    op.drop_index("ix_email_queue_scheduled_for", table_name="email_queue")
    op.drop_index("ix_email_queue_user_signup_id", table_name="email_queue")
    op.drop_table("email_queue")
