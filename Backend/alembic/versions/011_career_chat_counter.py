"""Add career_chat_free_used flag to user_signups (first-message-free gate).

Revision ID: 011
Revises: 010
"""

from alembic import op
import sqlalchemy as sa


revision = "011"
down_revision = "010"


def upgrade() -> None:
    op.add_column(
        "user_signups",
        sa.Column("career_chat_free_used", sa.Boolean(), server_default=sa.false(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_signups", "career_chat_free_used")
