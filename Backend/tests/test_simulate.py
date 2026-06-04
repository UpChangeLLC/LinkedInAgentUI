"""What-If simulator: apply scenario patches to the base profile/survey and
re-score through the existing ML seam (services.ml_client.score_profile)."""
import asyncio

import services.simulate as sim


def test_apply_scenarios_certification_adds_cert_and_bumps_learning():
    profile, survey, ctx = sim.apply_scenarios(
        {"skills": ["python"], "certifications": []},
        {"q_lv_1": "0"},
        {},
        [{"type": "certification", "value": "AWS AI Practitioner"}],
    )
    assert "AWS AI Practitioner" in profile["certifications"]
    # learning-velocity survey signal increases
    assert survey["q_lv_1"] in ("3-5", "6+")
    # original input is not mutated
    assert profile is not None


def test_apply_scenarios_skill_and_project_and_company():
    base_profile = {"skills": ["sql"], "experiences": []}
    profile, survey, ctx = sim.apply_scenarios(
        base_profile,
        {},
        {"industry": "finance"},
        [
            {"type": "skill", "value": "Python"},
            {"type": "project", "value": "Lead AI Platform"},
            {"type": "company", "value": "Artificial Intelligence"},
        ],
    )
    assert "Python" in profile["skills"]
    assert len(profile["experiences"]) == 1
    assert ctx["industry"] == "Artificial Intelligence"
    # base inputs untouched (deep copy)
    assert base_profile["skills"] == ["sql"]
    assert base_profile["experiences"] == []


def test_simulate_returns_projected_scores(monkeypatch):
    # Cached canonical base profile (raw_data is already normalized).
    async def fake_cache(_key):
        return {"raw_data": {"skills": ["sql"], "certifications": [], "experiences": []}}

    async def fake_score(result, merged_profile, survey_responses=None, user_context=None, **kw):
        # Reward more skills so the projection visibly moves.
        n = len(merged_profile.get("skills", []))
        result["resilience_score"] = 40 + 5 * n
        result["readiness_score"] = 30 + 5 * n
        result["dimension_scores"] = {}
        return result

    monkeypatch.setattr(sim, "get_cached_dataset_any_age", fake_cache)
    monkeypatch.setattr(sim, "score_profile", fake_score)

    out = asyncio.run(sim.simulate(
        linkedin_url="https://linkedin.com/in/x",
        survey_responses={},
        user_context={},
        scenarios=[{"type": "skill", "value": "Python"}],
    ))
    assert out["available"] is True
    # base "sql" + added "Python" = 2 skills → 40 + 5*2 / 30 + 5*2
    assert out["resilience_score"] == 50
    assert out["readiness_score"] == 40


def test_simulate_unavailable_when_no_cached_profile(monkeypatch):
    async def fake_cache(_key):
        return None

    monkeypatch.setattr(sim, "get_cached_dataset_any_age", fake_cache)
    out = asyncio.run(sim.simulate(
        linkedin_url="https://linkedin.com/in/x",
        survey_responses={}, user_context={}, scenarios=[],
    ))
    assert out["available"] is False
