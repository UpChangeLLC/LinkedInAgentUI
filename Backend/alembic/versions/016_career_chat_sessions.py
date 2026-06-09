"""Per-user career-chat session index.

Revision ID: 016
Revises: 015

Creates the listable, account-tied index of mentor threads (messages stay in
Redis). Powers the session rail and enforces ownership on history/rename/delete.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "016"
down_revision = "015"


def upgrade() -> None:
    op.create_table(
        "career_chat_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_signup_id", UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False, server_default="New chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_signup_id"], ["user_signups.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_career_chat_sessions_session_id", "career_chat_sessions", ["session_id"], unique=True
    )
    op.create_index(
        "ix_career_chat_sessions_user_signup_id", "career_chat_sessions", ["user_signup_id"], unique=False
    )
    op.create_index(
        "idx_career_chat_sessions_user_last",
        "career_chat_sessions",
        ["user_signup_id", "last_message_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_career_chat_sessions_user_last", table_name="career_chat_sessions")
    op.drop_index("ix_career_chat_sessions_user_signup_id", table_name="career_chat_sessions")
    op.drop_index("ix_career_chat_sessions_session_id", table_name="career_chat_sessions")
    op.drop_table("career_chat_sessions")
