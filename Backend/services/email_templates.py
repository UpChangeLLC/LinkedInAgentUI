"""Lifecycle email template registry (Workstream D, spec 03 §6).

Single source of truth for the 7 transactional templates. Each renderer takes
the per-row `model` dict (from `build_assessment_model`) and returns a `subject`
and a plain-text `body`. The dispatcher merges these into the model before
handing to `services.email.send_email`:

  * Postmark — server-side templates render via `TemplateAlias`; the body here
    is only used as a fallback / dev preview. Copy the subject/body into the
    Postmark dashboard under the matching alias.
  * Resend — has no server templates; we send `subject` + `text` straight
    through, so the strings below are what the user will actually see.

Keep the copy aligned with spec 03 §6.2. New templates → add to ``RENDERERS``
and (if lifecycle) to ``email_lifecycle.plan_assessment_emails``.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Tuple


# Each renderer: model (dict) -> (subject, text body).
Renderer = Callable[[Dict[str, Any]], Tuple[str, str]]


def _hi(model: Dict[str, Any]) -> str:
    name = (model.get("first_name") or "").strip()
    return f"Hi {name}," if name else "Hi,"


def _score_line(model: Dict[str, Any]) -> str:
    res = model.get("resilience_score")
    rdy = model.get("readiness_score")
    if res is None and rdy is None:
        return ""
    parts = []
    if res is not None:
        parts.append(f"resilience {res}/100")
    if rdy is not None:
        parts.append(f"readiness {rdy}/100")
    return "Your scores: " + " · ".join(parts) + "."


def _welcome(model: Dict[str, Any]) -> Tuple[str, str]:
    subject = "Welcome to Upchange — your AI Resilience Score is live"
    body = (
        f"{_hi(model)}\n\n"
        "Thanks for running your AI Resilience assessment. "
        f"{_score_line(model)}\n\n"
        "Your free dashboard shows your score, an 8-dimension breakdown, and a short\n"
        "narrative of where you stand. Premium unlocks per-dimension rationales,\n"
        "a personalized 90-day roadmap, the Career Mentor, and a curated learning\n"
        "library.\n\n"
        "→ Open your dashboard: https://upchange.ai/dashboard\n\n"
        "— The Upchange team"
    )
    return subject, body


def _score_explainer(model: Dict[str, Any]) -> Tuple[str, str]:
    subject = "How to read your AI Resilience Score"
    body = (
        f"{_hi(model)}\n\n"
        "Quick refresher on what your score means:\n\n"
        " • Resilience (0–100) — your long-run position vs. AI shifts in your role.\n"
        " • Readiness (0–100)  — how prepared you are today.\n"
        " • 8 dimensions       — 4 deterministic (profile-anchored) + 4 AI-judged.\n\n"
        f"{_score_line(model)}\n\n"
        "Two dimensions usually drive the biggest gap in cohorts like yours:\n"
        "governance awareness and learning velocity. Both are something you can\n"
        "move in a quarter. Open your dashboard for the 'What your score means'\n"
        "section — it calls out your strongest edge and biggest risk.\n\n"
        "→ Dashboard: https://upchange.ai/dashboard\n"
    )
    return subject, body


def _decay(days: int) -> Renderer:
    def render(model: Dict[str, Any]) -> Tuple[str, str]:
        subject = f"Your AI Resilience Score is {days} days old"
        body = (
            f"{_hi(model)}\n\n"
            f"It's been about {days} days since your last assessment. AI roles move fast —\n"
            "re-running takes ~3 minutes and shows you how you've changed since last time.\n\n"
            f"{_score_line(model)}\n\n"
            "→ Re-run: https://upchange.ai/intake\n"
        )
        return subject, body

    return render


def _rerun_available(model: Dict[str, Any]) -> Tuple[str, str]:
    subject = "Your free re-run unlocks today"
    body = (
        f"{_hi(model)}\n\n"
        "30 days have passed — your next free assessment is unlocked. Run it now\n"
        "and we'll plot your trajectory on the dashboard so you can see what moved.\n\n"
        f"{_score_line(model)}\n\n"
        "→ Re-run now: https://upchange.ai/intake\n\n"
        "(Premium = unlimited re-runs, anytime.)\n"
    )
    return subject, body


def _premium_upsell(model: Dict[str, Any]) -> Tuple[str, str]:
    subject = "Unlock your full AI Resilience plan — $9/mo"
    body = (
        f"{_hi(model)}\n\n"
        "You've seen the score. Premium unlocks what to do about it:\n\n"
        " • Per-dimension rationales — why each score landed where it did.\n"
        " • 10 personalized actions  — ranked by impact, tied to your gaps.\n"
        " • Career Mentor chat       — unlimited; trained on your profile + score.\n"
        " • 23-resource library      — curated for your role + dimensions.\n"
        " • Unlimited re-runs        — track your trajectory month over month.\n\n"
        "→ Upgrade: https://upchange.ai/subscribe?source=email_upsell\n\n"
        "Reply if you have questions. We read every one.\n"
    )
    return subject, body


RENDERERS: Dict[str, Renderer] = {
    "welcome": _welcome,
    "score_explainer": _score_explainer,
    "decay_nudge_21d": _decay(21),
    "decay_nudge_30d": _decay(30),
    "decay_nudge_45d": _decay(45),
    "rerun_available": _rerun_available,
    "premium_upsell": _premium_upsell,
}


def render(template: str, model: Dict[str, Any]) -> Tuple[str, str]:
    """Render `(subject, body)` for a template; ('','') if unknown.

    Unknown templates intentionally don't raise so the dispatcher can mark the
    row 'skipped' instead of poisoning the queue with retries.
    """
    fn = RENDERERS.get(template or "")
    if fn is None:
        return "", ""
    return fn(model or {})
