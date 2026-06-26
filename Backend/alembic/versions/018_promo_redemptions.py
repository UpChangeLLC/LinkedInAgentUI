"""Promo code redemptions: track limited-slot launch promo grants.

Revision ID: 018
Revises: 017

Records redemptions of free-month promo codes (EARLYBIRD, FIFA) so the
per-code 25-slot cap (a row count) and the one-per-user rule (a unique index)
are enforced atomically. Stripe-discount codes (FIFA50) are not stored here.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "018"
down_revision = "017"


def upgrade() -> None:
    op.create_table(
        "promo_redemptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column(
            "user_signup_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_signups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("months", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="granted"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code", "user_signup_id", name="uq_promo_redemptions_code_user"),
    )
    op.create_index("idx_promo_redemptions_code", "promo_redemptions", ["code"], unique=False)
    op.create_index(
        "ix_promo_redemptions_user_signup_id", "promo_redemptions", ["user_signup_id"], unique=False
    )
    op.create_index(
        "ix_promo_redemptions_created_at", "promo_redemptions", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_promo_redemptions_created_at", table_name="promo_redemptions")
    op.drop_index("ix_promo_redemptions_user_signup_id", table_name="promo_redemptions")
    op.drop_index("idx_promo_redemptions_code", table_name="promo_redemptions")
    op.drop_table("promo_redemptions")
