"""Email verification, password reset, and free-chat message counter.

Revision ID: 017
Revises: 016

Adds to user_signups:
  * career_chat_messages_used  — free-tier message counter (gated by
    FREE_CHAT_MESSAGE_LIMIT), superseding the boolean career_chat_free_used.
  * email_verified (+ token hash/expiry) — soft-nag email verification.
  * password_reset token hash/expiry      — emailed password-reset link.
"""

from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"


def upgrade() -> None:
    op.add_column(
        "user_signups",
        sa.Column(
            "career_chat_messages_used",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "user_signups",
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "user_signups",
        sa.Column("email_verification_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_signups",
        sa.Column(
            "email_verification_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "user_signups",
        sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_signups",
        sa.Column(
            "password_reset_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_user_signups_email_verification_token_hash",
        "user_signups",
        ["email_verification_token_hash"],
        unique=False,
    )
    op.create_index(
        "ix_user_signups_password_reset_token_hash",
        "user_signups",
        ["password_reset_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_signups_password_reset_token_hash", table_name="user_signups"
    )
    op.drop_index(
        "ix_user_signups_email_verification_token_hash", table_name="user_signups"
    )
    op.drop_column("user_signups", "password_reset_token_expires_at")
    op.drop_column("user_signups", "password_reset_token_hash")
    op.drop_column("user_signups", "email_verification_token_expires_at")
    op.drop_column("user_signups", "email_verification_token_hash")
    op.drop_column("user_signups", "email_verified")
    op.drop_column("user_signups", "career_chat_messages_used")
