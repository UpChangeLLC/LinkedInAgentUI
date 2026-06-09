"""Stripe billing: tier + customer linkage + idempotency columns.

Revision ID: 015
Revises: 014

Adds Free/Pro tiering and Stripe identifiers. All columns are nullable or
defaulted so this is a zero-downtime add on existing rows.
"""

from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"


def upgrade() -> None:
    op.add_column(
        "user_signups",
        sa.Column("subscription_tier", sa.String(length=20), server_default="free", nullable=False),
    )
    op.add_column(
        "user_signups",
        sa.Column("stripe_customer_id", sa.String(length=120), nullable=True),
    )
    op.create_index(
        "ix_user_signups_stripe_customer_id", "user_signups", ["stripe_customer_id"], unique=False
    )

    op.add_column(
        "payment_sessions",
        sa.Column("stripe_subscription_id", sa.String(length=120), nullable=True),
    )
    op.create_index(
        "ix_payment_sessions_stripe_subscription_id",
        "payment_sessions",
        ["stripe_subscription_id"],
        unique=False,
    )

    op.add_column(
        "payment_events",
        sa.Column("stripe_event_id", sa.String(length=120), nullable=True),
    )
    op.create_index(
        "ix_payment_events_stripe_event_id",
        "payment_events",
        ["stripe_event_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_payment_events_stripe_event_id", table_name="payment_events")
    op.drop_column("payment_events", "stripe_event_id")
    op.drop_index("ix_payment_sessions_stripe_subscription_id", table_name="payment_sessions")
    op.drop_column("payment_sessions", "stripe_subscription_id")
    op.drop_index("ix_user_signups_stripe_customer_id", table_name="user_signups")
    op.drop_column("user_signups", "stripe_customer_id")
    op.drop_column("user_signups", "subscription_tier")
