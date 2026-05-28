"""Tests for services.email_lifecycle.plan_assessment_emails (Workstream D)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _templates(plan):
    return {p["template"] for p in plan}


class TestPlanAssessmentEmails:
    def test_first_free_run_gets_welcome_explainer_and_decay(self):
        from services.email_lifecycle import plan_assessment_emails

        plan = plan_assessment_emails(is_first=True, is_premium=False)
        t = _templates(plan)
        assert "welcome" in t
        assert "score_explainer" in t
        assert {"decay_nudge_21d", "decay_nudge_30d", "decay_nudge_45d"} <= t

    def test_repeat_free_run_only_decay(self):
        from services.email_lifecycle import plan_assessment_emails

        plan = plan_assessment_emails(is_first=False, is_premium=False)
        t = _templates(plan)
        assert "welcome" not in t
        assert "score_explainer" not in t
        assert {"decay_nudge_21d", "decay_nudge_30d", "decay_nudge_45d"} <= t

    def test_premium_first_run_only_welcome(self):
        from services.email_lifecycle import plan_assessment_emails

        plan = plan_assessment_emails(is_first=True, is_premium=True)
        t = _templates(plan)
        assert t == {"welcome"}

    def test_premium_repeat_run_nothing(self):
        from services.email_lifecycle import plan_assessment_emails

        assert plan_assessment_emails(is_first=False, is_premium=True) == []

    def test_offsets_and_streams(self):
        from services.email_lifecycle import plan_assessment_emails

        plan = plan_assessment_emails(is_first=True, is_premium=False)
        by_template = {p["template"]: p for p in plan}
        assert by_template["welcome"]["offset_days"] == 0
        assert by_template["welcome"]["message_stream"] == "welcome"
        assert by_template["score_explainer"]["offset_days"] == 3
        assert by_template["decay_nudge_30d"]["offset_days"] == 30
        assert by_template["decay_nudge_30d"]["message_stream"] == "decay_nudge"
