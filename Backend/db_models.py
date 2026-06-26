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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Profile(Base):
    """Central identity for a LinkedIn profile — the canonical entity all tables reference."""

    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url_hash = Column(String(64), nullable=False, unique=True, index=True)
    linkedin_url = Column(String(500), nullable=True)
    display_name = Column(String(200), nullable=True)
    title = Column(String(200), nullable=True)
    company = Column(String(200), nullable=True)
    first_assessed_at = Column(DateTime(timezone=True), nullable=True)
    last_assessed_at = Column(DateTime(timezone=True), nullable=True)
    assessment_count = Column(Integer, default=0)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class PipelineRun(Base):
    """Records every pipeline execution for observability and analytics."""

    __tablename__ = "pipeline_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Input tracking
    linkedin_url = Column(String(500), nullable=True)
    url_hash = Column(String(64), nullable=True, index=True)
    resume_provided = Column(Boolean, default=False)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # User who initiated this run (v1: every run is tied to a signed-in user;
    # legacy/anonymous rows are NULL). See migration 008.
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

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


class UserSignup(Base):
    """User contact record captured before showing assessment results."""

    __tablename__ = "user_signups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User-provided contact details
    full_name = Column(String(200), nullable=False)
    email = Column(String(320), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(200), nullable=True)
    role_title = Column(String(200), nullable=True)

    # Intake metadata
    linkedin_url = Column(String(500), nullable=True)
    url_hash = Column(String(64), nullable=True, index=True)
    resume_provided = Column(Boolean, default=False)
    github_url = Column(String(500), nullable=True)
    website_url = Column(String(500), nullable=True)
    user_context = Column(JSONB, nullable=True)

    # Assessment snapshot at signup time
    assessment_snapshot = Column(JSONB, nullable=True)
    marketing_opt_in = Column(Boolean, default=False)

    # Demo auth/subscription state. Replace with real auth + payment provider before production.
    access_token_hash = Column(String(64), nullable=True, unique=True, index=True)
    password_hash = Column(String(300), nullable=True)
    oauth_provider = Column(String(50), nullable=True, index=True)
    oauth_subject = Column(String(200), nullable=True, index=True)
    subscription_status = Column(String(30), nullable=False, default="trial")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Free/Pro tier — single source of truth lives in services.entitlements.
    subscription_tier = Column(String(20), nullable=False, default="free")
    # Stripe billing linkage.
    stripe_customer_id = Column(String(120), nullable=True, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Retention: legacy first-message-free flag (superseded by the counter below).
    career_chat_free_used = Column(Boolean, default=False)
    # Free Career Mentor messages consumed (gated by FREE_CHAT_MESSAGE_LIMIT).
    career_chat_messages_used = Column(Integer, nullable=False, default=0)

    # Email verification (soft-nag): unverified users can still use the app.
    email_verified = Column(Boolean, nullable=False, default=False)
    email_verification_token_hash = Column(String(64), nullable=True, index=True)
    email_verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Password reset via emailed one-time token.
    password_reset_token_hash = Column(String(64), nullable=True, index=True)
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_user_signups_email_created", "email", "created_at"),
        Index("idx_user_signups_url_created", "url_hash", "created_at"),
    )


class PaymentSession(Base):
    """Checkout session created by the configured payment provider."""

    __tablename__ = "payment_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider = Column(String(50), nullable=False, default="mock")
    provider_session_id = Column(String(120), nullable=False, unique=True, index=True)
    stripe_subscription_id = Column(String(120), nullable=True, index=True)
    plan_id = Column(String(50), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    months = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="created")
    event_metadata = Column("metadata", JSONB, nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_payment_sessions_user_created", "user_signup_id", "created_at"),
        Index("idx_payment_sessions_status_created", "status", "created_at"),
    )


class PaymentEvent(Base):
    """Auditable payment-provider event log."""

    __tablename__ = "payment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider = Column(String(50), nullable=False, default="mock")
    event_type = Column(String(100), nullable=False, index=True)
    provider_session_id = Column(String(120), nullable=True, index=True)
    # Stripe event id — unique so webhook processing is idempotent on replay.
    stripe_event_id = Column(String(120), nullable=True, unique=True, index=True)
    payload = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_payment_events_user_created", "user_signup_id", "created_at"),
    )


class PromoRedemption(Base):
    """A redeemed promotional code (the per-code 25-slot cap is a row count).

    Free-month codes (EARLYBIRD, FIFA) are recorded here with status
    ``granted`` when the subscription is activated. The unique (code, user)
    constraint enforces one redemption per user; counting rows for a code
    enforces the limited-slot cap. Percentage-discount codes that run through
    Stripe (e.g. FIFA50) are NOT recorded here — Stripe's promotion-code limit
    is the source of truth for those.
    """

    __tablename__ = "promo_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(40), nullable=False, index=True)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(20), nullable=False)
    months = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="granted")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("code", "user_signup_id", name="uq_promo_redemptions_code_user"),
        Index("idx_promo_redemptions_code", "code"),
    )


class CareerChatSession(Base):
    """Per-user index of Career Mentor threads.

    Messages live in Redis (``career_chat:hist:v1:{sid}``); this table is the
    listable, account-tied index that powers the session rail and enforces
    ownership on history/rename/delete.
    """

    __tablename__ = "career_chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The opaque Redis session id this row indexes.
    session_id = Column(String(128), nullable=False, unique=True, index=True)
    title = Column(String(120), nullable=False, default="New chat")
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    last_message_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_career_chat_sessions_user_last", "user_signup_id", "last_message_at"),
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


class AssessmentHistory(Base):
    """Tracks score history per LinkedIn URL for delta computation (F22)."""

    __tablename__ = "assessment_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url_hash = Column(String(64), nullable=False, index=True)

    # Score snapshot
    score = Column(Integer, nullable=False)
    dimension_scores = Column(JSONB, nullable=True)  # {dim_name: {score, ...}}
    risk_band = Column(String(100), nullable=True)

    # Resilience Score v1 fields (migration 010). In v0 these mirror `score`;
    # the ML platform later differentiates resilience vs readiness and adds SHAP.
    resilience_score = Column(Integer, nullable=True)
    readiness_score = Column(Integer, nullable=True)
    shap_attribution = Column(JSONB, nullable=True)

    # Historical-recompute bookkeeping (v0 -> v1 backfill, design doc §7.5)
    is_v0_legacy = Column(Boolean, default=False)
    recomputed_at = Column(DateTime(timezone=True), nullable=True)
    legacy_score = Column(Integer, nullable=True)
    legacy_dimension_scores = Column(JSONB, nullable=True)

    # Link to the pipeline run that produced this score
    pipeline_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("idx_assessment_history_url_created", "url_hash", "created_at"),
    )


class SurveyResponses(Base):
    """Captured onboarding survey answers, one row per pipeline run (spec 01 §8.3)."""

    __tablename__ = "survey_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"),
        nullable=True,
        unique=True,
    )
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    url_hash = Column(String(64), nullable=True, index=True)
    responses = Column(JSONB, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class NotificationPreferences(Base):
    """Per-user email stream opt-ins (spec 03 §6.3)."""

    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    score_updates = Column(Boolean, default=True)         # welcome + score-explainer
    reassessment_reminders = Column(Boolean, default=True)  # decay nudges
    product_tips = Column(Boolean, default=True)          # premium upsell
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=True)


class EmailQueue(Base):
    """Postgres-backed transactional email queue (spec 03 §6.4)."""

    __tablename__ = "email_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    template = Column(String(100), nullable=False)
    model = Column(JSONB, nullable=True)
    message_stream = Column(String(50), nullable=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=False, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="queued")  # queued|sent|skipped|failed
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class MlInferenceLog(Base):
    """Audit row for each scoring call (Workstream C, plan §Migrations).

    The ML platform stays stateless; the orchestrator writes one row here after
    receiving (or falling back from) a score, so we can audit which model
    produced which result and watch the v1 fall-through rate during cutover.
    """

    __tablename__ = "ml_inference_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_signup_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_signups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Which scorer answered + provenance.
    scoring_version = Column(String(10), nullable=False, default="v0")  # v0|v1
    model_version = Column(String(100), nullable=True)
    onet_version = Column(String(100), nullable=True)

    # Whether the ML platform was attempted and whether we fell back to v0.
    platform_attempted = Column(Boolean, nullable=False, default=False)
    fell_back = Column(Boolean, nullable=False, default=False)
    latency_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)

    # Score snapshot for audit (not authoritative — assessment_history is).
    resilience_score = Column(Integer, nullable=True)
    readiness_score = Column(Integer, nullable=True)
    shap_attribution = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class ActionItem(Base):
    """Personalized action items generated per assessment (F24)."""

    __tablename__ = "action_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url_hash = Column(String(64), nullable=False, index=True)

    # Action details
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # learning, networking, projects, governance
    priority = Column(String(20), nullable=True)  # high, medium, low
    estimated_hours = Column(Integer, nullable=True)
    resource_url = Column(String(2000), nullable=True)
    resource_title = Column(String(500), nullable=True)

    # Status tracking
    status = Column(String(20), nullable=False, default="pending")  # pending, in_progress, completed
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Link to source assessment
    pipeline_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_action_items_url_status", "url_hash", "status"),
    )


class Team(Base):
    """Team for group challenge leaderboard (F25)."""

    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    created_by_url_hash = Column(String(64), nullable=False)
    created_by_profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    invite_code = Column(String(20), nullable=False, unique=True, index=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class TeamMember(Base):
    """Individual member of a team challenge (F25)."""

    __tablename__ = "team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url_hash = Column(String(64), nullable=False)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    display_name = Column(String(200), nullable=False)
    score = Column(Integer, nullable=False, default=0)
    role_category = Column(String(100), nullable=True)

    joined_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_team_members_team_id", "team_id"),
    )


class MarketEmbedding(Base):
    """Market signal vector store — replaces Data/market_vectors.jsonl.

    NOTE: This table exists in the schema but has no write path yet.
    Reserved for a future market signal ingestion pipeline.
    """

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
