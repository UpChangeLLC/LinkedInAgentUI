"""Add user_signups table.

Revision ID: 006
Revises: 005
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "006"
down_revision = "005"


def upgrade() -> None:
    op.create_table(
        "user_signups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("role_title", sa.String(length=200), nullable=True),
        sa.Column("linkedin_url", sa.String(length=500), nullable=True),
        sa.Column("url_hash", sa.String(length=64), nullable=True),
        sa.Column("resume_provided", sa.Boolean(), nullable=True),
        sa.Column("github_url", sa.String(length=500), nullable=True),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("user_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("assessment_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("marketing_opt_in", sa.Boolean(), nullable=True),
        sa.Column("access_token_hash", sa.String(length=64), nullable=True),
        sa.Column("password_hash", sa.String(length=300), nullable=True),
        sa.Column("oauth_provider", sa.String(length=50), nullable=True),
        sa.Column("oauth_subject", sa.String(length=200), nullable=True),
        sa.Column("subscription_status", sa.String(length=30), nullable=False, server_default="trial"),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_signups_email", "user_signups", ["email"])
    op.create_index("ix_user_signups_url_hash", "user_signups", ["url_hash"])
    op.create_index("ix_user_signups_access_token_hash", "user_signups", ["access_token_hash"], unique=True)
    op.create_index("ix_user_signups_oauth_provider", "user_signups", ["oauth_provider"])
    op.create_index("ix_user_signups_oauth_subject", "user_signups", ["oauth_subject"])
    op.create_index("ix_user_signups_created_at", "user_signups", ["created_at"])
    op.create_index("idx_user_signups_email_created", "user_signups", ["email", "created_at"])
    op.create_index("idx_user_signups_url_created", "user_signups", ["url_hash", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_user_signups_url_created", table_name="user_signups")
    op.drop_index("idx_user_signups_email_created", table_name="user_signups")
    op.drop_index("ix_user_signups_created_at", table_name="user_signups")
    op.drop_index("ix_user_signups_oauth_subject", table_name="user_signups")
    op.drop_index("ix_user_signups_oauth_provider", table_name="user_signups")
    op.drop_index("ix_user_signups_access_token_hash", table_name="user_signups")
    op.drop_index("ix_user_signups_url_hash", table_name="user_signups")
    op.drop_index("ix_user_signups_email", table_name="user_signups")
    op.drop_table("user_signups")
