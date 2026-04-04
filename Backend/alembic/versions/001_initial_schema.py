"""Initial schema — pipeline_runs, apify_cache, analytics_events, market_embeddings.

Revision ID: 001
Revises:
Create Date: 2026-04-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # pipeline_runs
    # ------------------------------------------------------------------
    op.create_table(
        "pipeline_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("url_hash", sa.String(64), nullable=True),
        sa.Column("resume_provided", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("data_source", sa.String(50), nullable=True),
        sa.Column("ai_client", sa.String(50), nullable=True),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("trace", postgresql.JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("error_node", sa.String(100), nullable=True),
        sa.Column("client_ip_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_pipeline_runs_created_at", "pipeline_runs", ["created_at"])
    op.create_index("idx_pipeline_runs_url_hash", "pipeline_runs", ["url_hash"])
    op.create_index(
        "idx_pipeline_runs_error",
        "pipeline_runs",
        ["error"],
        postgresql_where=sa.text("error IS NOT NULL"),
    )

    # ------------------------------------------------------------------
    # apify_cache
    # ------------------------------------------------------------------
    op.create_table(
        "apify_cache",
        sa.Column("url_hash", sa.String(64), primary_key=True),
        sa.Column("dataset_id", sa.String(100), nullable=False),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("actor_id", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_hit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hit_count", sa.Integer(), server_default=sa.text("0")),
    )
    op.create_index("idx_apify_cache_expires", "apify_cache", ["expires_at"])

    # ------------------------------------------------------------------
    # analytics_events
    # ------------------------------------------------------------------
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "pipeline_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_analytics_event_type", "analytics_events", ["event_type"])
    op.create_index("idx_analytics_created_at", "analytics_events", ["created_at"])
    op.create_index("idx_analytics_type_created", "analytics_events", ["event_type", "created_at"])

    # ------------------------------------------------------------------
    # market_embeddings
    # ------------------------------------------------------------------
    op.create_table(
        "market_embeddings",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("role", sa.String(200), nullable=False),
        sa.Column("url", sa.String(2000), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), server_default=sa.text("0")),
        sa.Column("embedding", postgresql.JSONB(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_market_embeddings_role", "market_embeddings", ["role"])


def downgrade() -> None:
    op.drop_table("market_embeddings")
    op.drop_table("analytics_events")
    op.drop_table("apify_cache")
    op.drop_table("pipeline_runs")
