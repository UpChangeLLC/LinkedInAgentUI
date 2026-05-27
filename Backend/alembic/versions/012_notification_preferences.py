"""Add notification_preferences table (per-stream email opt-ins).

Revision ID: 012
Revises: 011
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "012"
down_revision = "011"


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_signup_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score_updates", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("reassessment_reminders", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("product_tips", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_signup_id", name="uq_notification_prefs_user"),
    )
    op.create_index(
        "ix_notification_preferences_user_signup_id", "notification_preferences", ["user_signup_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_notification_preferences_user_signup_id", table_name="notification_preferences")
    op.drop_table("notification_preferences")
