"""Tests for services.ml_client — the scoring seam.

v0 path wraps the existing calibrate_score and maps its output additively into
the resilience/readiness shape. v1 path calls the ML platform, falling through
to v0 on any error so the pipeline never fails before the platform is live.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _base_result() -> dict:
    # No dimension_scores -> calibrate_score returns result unchanged, so the
    # provided profile_score is preserved for the mapping assertions.
    return {"profile_score": 67, "summary": "x"}


@pytest.mark.asyncio
class TestV0Mapping:
    async def test_additive_shape_when_platform_disabled(self):
        import services.ml_client as ml_client

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "false"}):
            out = await ml_client.score_profile(_base_result(), merged_profile={})

        assert out["scoring_version"] == "v0"
        assert out["resilience_score"] == 67
        assert out["readiness_score"] == 67
        assert out["risk_score"] == 33
        assert out["resilience_percentile"] is None
        assert out["readiness_percentile"] is None
        assert out["shap_attribution"] == []
        # profile_score preserved for backward-compatible transform.ts
        assert out["profile_score"] == 67


@pytest.mark.asyncio
class TestV1Path:
    async def test_falls_through_to_v0_on_error(self):
        import services.ml_client as ml_client

        async def boom(payload):
            raise RuntimeError("ml platform down")

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "true"}):
            with patch.object(ml_client, "_call_ml_platform", side_effect=boom):
                out = await ml_client.score_profile(_base_result(), merged_profile={})

        assert out["scoring_version"] == "v0"
        assert out["resilience_score"] == 67

    async def test_uses_platform_values_on_success(self):
        import services.ml_client as ml_client

        async def ok(payload):
            return {
                "resilience_score": 71,
                "readiness_score": 58,
                "resilience_percentile": 72,
                "readiness_percentile": 54,
                "risk_band": "low",
                "dimension_scores": {"ai_fluency": {"score": 6.2}},
                "shap_attribution": [{"dimension": "ai_fluency", "contribution_points": 3.1}],
                "scoring_version": "v1",
            }

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "true"}):
            with patch.object(ml_client, "_call_ml_platform", side_effect=ok):
                out = await ml_client.score_profile(_base_result(), merged_profile={})

        assert out["scoring_version"] == "v1"
        assert out["resilience_score"] == 71
        assert out["readiness_score"] == 58
        assert out["resilience_percentile"] == 72
        assert out["shap_attribution"][0]["dimension"] == "ai_fluency"


@pytest.mark.asyncio
class TestMlMeta:
    """The ephemeral `_ml_meta` drives ml_inference_log; assert each path stamps it."""

    async def test_v0_disabled_meta(self):
        import services.ml_client as ml_client

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "false"}):
            out = await ml_client.score_profile(_base_result(), merged_profile={})

        meta = out[ml_client.ML_META_KEY]
        assert meta["platform_attempted"] is False
        assert meta["fell_back"] is False
        assert meta["error"] is None

    async def test_v1_fallback_meta(self):
        import services.ml_client as ml_client

        async def boom(payload):
            raise RuntimeError("ml platform down")

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "true"}):
            with patch.object(ml_client, "_call_ml_platform", side_effect=boom):
                out = await ml_client.score_profile(_base_result(), merged_profile={})

        meta = out[ml_client.ML_META_KEY]
        assert meta["platform_attempted"] is True
        assert meta["fell_back"] is True
        assert "ml platform down" in (meta["error"] or "")
        assert isinstance(meta["latency_ms"], int)

    async def test_v1_success_meta(self):
        import services.ml_client as ml_client

        async def ok(payload):
            return {"resilience_score": 71, "readiness_score": 58, "scoring_version": "v1", "model_version": "res-v1.0.0"}

        with patch.dict(os.environ, {"USE_ML_PLATFORM": "true"}):
            with patch.object(ml_client, "_call_ml_platform", side_effect=ok):
                out = await ml_client.score_profile(_base_result(), merged_profile={})

        meta = out[ml_client.ML_META_KEY]
        assert meta["platform_attempted"] is True
        assert meta["fell_back"] is False
        assert meta["model_version"] == "res-v1.0.0"
