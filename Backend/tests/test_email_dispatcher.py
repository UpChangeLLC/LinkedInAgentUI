"""Tests for services.email_dispatcher skip logic (Workstream D email lifecycle)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestStreamPrefField:
    def test_maps_streams(self):
        from services.email_dispatcher import stream_pref_field

        assert stream_pref_field("welcome") == "score_updates"
        assert stream_pref_field("score_explainer") == "score_updates"
        assert stream_pref_field("decay_nudge") == "reassessment_reminders"
        assert stream_pref_field("premium_upsell") == "product_tips"
        assert stream_pref_field("transactional") is None


class TestShouldSkip:
    def test_transactional_never_skipped(self):
        from services.email_dispatcher import should_skip

        assert should_skip("transactional", user_is_premium=True, prefs=None) is False

    def test_unsubscribed_stream_skipped(self):
        from services.email_dispatcher import should_skip

        prefs = {"score_updates": False, "reassessment_reminders": True, "product_tips": True}
        assert should_skip("welcome", user_is_premium=False, prefs=prefs) is True
        assert should_skip("decay_nudge", user_is_premium=False, prefs=prefs) is False

    def test_premium_skips_upsell(self):
        from services.email_dispatcher import should_skip

        assert should_skip("premium_upsell", user_is_premium=True, prefs=None) is True

    def test_premium_skips_score_explainer(self):
        from services.email_dispatcher import should_skip

        assert should_skip("score_explainer", user_is_premium=True, prefs=None) is True

    def test_default_send_when_no_prefs(self):
        from services.email_dispatcher import should_skip

        assert should_skip("decay_nudge", user_is_premium=False, prefs=None) is False
