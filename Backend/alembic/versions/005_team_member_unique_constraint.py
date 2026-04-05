"""Add unique constraint on (team_id, url_hash) in team_members table.

Revision ID: 005
Revises: 004
"""

revision = "005"
down_revision = "004"

from alembic import op


def upgrade() -> None:
    # Remove any duplicate rows first (keep the most recent by id)
    op.execute("""
        DELETE FROM team_members a
        USING team_members b
        WHERE a.id < b.id
          AND a.team_id = b.team_id
          AND a.url_hash = b.url_hash
    """)
    op.create_unique_constraint(
        "uq_team_members_team_url_hash",
        "team_members",
        ["team_id", "url_hash"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_team_members_team_url_hash", "team_members")
