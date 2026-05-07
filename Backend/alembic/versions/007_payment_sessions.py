"""Add payment session tables.

Revision ID: 007
Revises: 006
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "007"
down_revision = "006"


def upgrade() -> None:
    op.create_table(
        "payment_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_session_id", sa.String(length=120), nullable=False),
        sa.Column("plan_id", sa.String(length=50), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("months", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_sessions_user_signup_id", "payment_sessions", ["user_signup_id"])
    op.create_index("ix_payment_sessions_provider_session_id", "payment_sessions", ["provider_session_id"], unique=True)
    op.create_index("ix_payment_sessions_created_at", "payment_sessions", ["created_at"])
    op.create_index("idx_payment_sessions_user_created", "payment_sessions", ["user_signup_id", "created_at"])
    op.create_index("idx_payment_sessions_status_created", "payment_sessions", ["status", "created_at"])

    op.create_table(
        "payment_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("provider_session_id", sa.String(length=120), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_events_user_signup_id", "payment_events", ["user_signup_id"])
    op.create_index("ix_payment_events_event_type", "payment_events", ["event_type"])
    op.create_index("ix_payment_events_provider_session_id", "payment_events", ["provider_session_id"])
    op.create_index("ix_payment_events_created_at", "payment_events", ["created_at"])
    op.create_index("idx_payment_events_user_created", "payment_events", ["user_signup_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_payment_events_user_created", table_name="payment_events")
    op.drop_index("ix_payment_events_created_at", table_name="payment_events")
    op.drop_index("ix_payment_events_provider_session_id", table_name="payment_events")
    op.drop_index("ix_payment_events_event_type", table_name="payment_events")
    op.drop_index("ix_payment_events_user_signup_id", table_name="payment_events")
    op.drop_table("payment_events")

    op.drop_index("idx_payment_sessions_status_created", table_name="payment_sessions")
    op.drop_index("idx_payment_sessions_user_created", table_name="payment_sessions")
    op.drop_index("ix_payment_sessions_created_at", table_name="payment_sessions")
    op.drop_index("ix_payment_sessions_provider_session_id", table_name="payment_sessions")
    op.drop_index("ix_payment_sessions_user_signup_id", table_name="payment_sessions")
    op.drop_table("payment_sessions")
