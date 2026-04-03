"""SQLAlchemy ORM models for the linkedin_agent database."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class PipelineRun(Base):
    """Records every pipeline execution for observability and analytics."""

    __tablename__ = "pipeline_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Input tracking
    linkedin_url = Column(String(500), nullable=True)
    url_hash = Column(String(64), nullable=True, index=True)
    resume_provided = Column(Boolean, default=False)

    # Pipeline execution metadata
    data_source = Column(String(50), nullable=True)
    ai_client = Column(String(50), nullable=True)
    ai_model = Column(String(100), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    # Output
    result = Column(JSONB, nullable=True)
    trace = Column(JSONB, nullable=True)

    # Error tracking
    error = Column(Text, nullable=True)
    error_node = Column(String(100), nullable=True)

    # Client metadata (anonymized)
    client_ip_hash = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_pipeline_runs_error", "error", postgresql_where=Column("error").isnot(None)),
    )


class ApifyCache(Base):
    """Replaces the file-based apify_dataset_cache.json."""

    __tablename__ = "apify_cache"

    url_hash = Column(String(64), primary_key=True)
    dataset_id = Column(String(100), nullable=False)
    raw_data = Column(JSONB, nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    actor_id = Column(String(200), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_hit_at = Column(DateTime(timezone=True), nullable=True)
    hit_count = Column(Integer, default=0)

    __table_args__ = (
        Index("idx_apify_cache_expires", "expires_at"),
    )


class AnalyticsEvent(Base):
    """Anonymized product analytics events for real metrics."""

    __tablename__ = "analytics_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(100), nullable=False, index=True)
    event_metadata = Column("metadata", JSONB, nullable=False, default=dict)

    pipeline_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_analytics_type_created", "event_type", "created_at"),
    )


class MarketEmbedding(Base):
    """Market signal vector store — replaces Data/market_vectors.jsonl."""

    __tablename__ = "market_embeddings"

    id = Column(String(64), primary_key=True)
    role = Column(String(200), nullable=False, index=True)
    url = Column(String(2000), nullable=True)
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, default=0)

    # Embedding stored as JSONB array (pgvector Column added when extension is available)
    # For initial migration we use JSONB; can migrate to vector(1536) later
    embedding = Column(JSONB, nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=True)
    fetched_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
