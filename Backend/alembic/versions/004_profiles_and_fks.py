"""Add profiles table and profile_id FK to all assessment tables.

Revision ID: 004
Revises: 003
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create the profiles table
    op.create_table(
        "profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("url_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("first_assessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_assessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assessment_count", sa.Integer(), server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_profiles_url_hash", "profiles", ["url_hash"], unique=True)

    # 2. Add profile_id FK to pipeline_runs
    op.add_column(
        "pipeline_runs",
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_pipeline_runs_profile_id", "pipeline_runs", ["profile_id"])

    # 3. Add profile_id FK to assessment_history
    op.add_column(
        "assessment_history",
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_assessment_history_profile_id", "assessment_history", ["profile_id"])

    # 4. Add profile_id FK to action_items
    op.add_column(
        "action_items",
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_action_items_profile_id", "action_items", ["profile_id"])

    # 5. Add created_by_profile_id FK to teams
    op.add_column(
        "teams",
        sa.Column(
            "created_by_profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 6. Add profile_id FK to team_members
    op.add_column(
        "team_members",
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_team_members_profile_id", "team_members", ["profile_id"])

    # 7. Backfill profiles from existing pipeline_runs data
    op.execute(
        """
        INSERT INTO profiles (id, url_hash, linkedin_url, first_assessed_at, last_assessed_at, assessment_count, created_at)
        SELECT
            gen_random_uuid(),
            pr.url_hash,
            MIN(pr.linkedin_url),
            MIN(pr.created_at),
            MAX(pr.created_at),
            COUNT(*),
            MIN(pr.created_at)
        FROM pipeline_runs pr
        WHERE pr.url_hash IS NOT NULL
        GROUP BY pr.url_hash
        ON CONFLICT (url_hash) DO NOTHING
        """
    )

    # 8. Backfill profile_id in pipeline_runs
    op.execute(
        """
        UPDATE pipeline_runs
        SET profile_id = p.id
        FROM profiles p
        WHERE pipeline_runs.url_hash = p.url_hash
          AND pipeline_runs.url_hash IS NOT NULL
          AND pipeline_runs.profile_id IS NULL
        """
    )

    # 9. Backfill profile_id in assessment_history
    op.execute(
        """
        UPDATE assessment_history
        SET profile_id = p.id
        FROM profiles p
        WHERE assessment_history.url_hash = p.url_hash
          AND assessment_history.profile_id IS NULL
        """
    )

    # 10. Backfill profile_id in action_items
    op.execute(
        """
        UPDATE action_items
        SET profile_id = p.id
        FROM profiles p
        WHERE action_items.url_hash = p.url_hash
          AND action_items.profile_id IS NULL
        """
    )

    # 11. Backfill profile_id in team_members
    op.execute(
        """
        UPDATE team_members
        SET profile_id = p.id
        FROM profiles p
        WHERE team_members.url_hash = p.url_hash
          AND team_members.profile_id IS NULL
        """
    )

    # 12. Backfill created_by_profile_id in teams
    op.execute(
        """
        UPDATE teams
        SET created_by_profile_id = p.id
        FROM profiles p
        WHERE teams.created_by_url_hash = p.url_hash
          AND teams.created_by_profile_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("idx_team_members_profile_id", table_name="team_members")
    op.drop_column("team_members", "profile_id")
    op.drop_column("teams", "created_by_profile_id")
    op.drop_index("idx_action_items_profile_id", table_name="action_items")
    op.drop_column("action_items", "profile_id")
    op.drop_index("idx_assessment_history_profile_id", table_name="assessment_history")
    op.drop_column("assessment_history", "profile_id")
    op.drop_index("idx_pipeline_runs_profile_id", table_name="pipeline_runs")
    op.drop_column("pipeline_runs", "profile_id")
    op.drop_index("idx_profiles_url_hash", table_name="profiles")
    op.drop_table("profiles")
