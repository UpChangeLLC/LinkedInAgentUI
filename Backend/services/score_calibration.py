"""
Score Calibration Service

Post-LLM calibration layer that transforms raw dimension scores into a
balanced composite score. Addresses LLM score inflation by applying:
1. Evidence penalty — deduct points for low confidence or missing evidence
2. Sigmoid compression — expand 30-70 range, compress 70-100
3. Completeness discount — sparse profiles score lower
4. Differentiation bonuses — reward rare, high-value signals
"""

from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Dimension weights (sum = 1.0) ────────────────────────────────────────────
DIMENSION_WEIGHTS = {
    "ai_fluency": 0.18,
    "technical_proximity": 0.14,
    "governance_awareness": 0.08,
    "learning_velocity": 0.14,
    "leadership_readiness": 0.12,
    "network_relevance": 0.08,
    "automation_exposure": 0.14,
    "execution_credibility": 0.12,
}

# ── Confidence penalties ─────────────────────────────────────────────────────
CONFIDENCE_PENALTY = {
    "low": 5,
    "medium": 1,
    "high": 0,
}


def _sigmoid(x: float, center: float = 50.0, steepness: float = 12.0) -> float:
    """Map raw 0-100 score through sigmoid centered at `center`."""
    z = (x - center) / steepness
    return 100.0 / (1.0 + math.exp(-z))


def _calculate_profile_completeness(profile: Dict[str, Any]) -> float:
    """Return 0.0-1.0 completeness score based on profile data richness."""
    signals = 0
    total = 8

    experiences = profile.get("experiences") or profile.get("positions") or []
    if len(experiences) >= 1:
        signals += 1
    if len(experiences) >= 3:
        signals += 1

    skills = profile.get("skills") or []
    if len(skills) >= 3:
        signals += 1
    if len(skills) >= 8:
        signals += 1

    if profile.get("summary") or profile.get("about"):
        signals += 1

    education = profile.get("education") or []
    if len(education) >= 1:
        signals += 1

    certifications = profile.get("certifications") or profile.get("certificates") or []
    if len(certifications) >= 1:
        signals += 1

    if profile.get("name") and profile.get("headline"):
        signals += 1

    return signals / total


def _detect_bonuses(profile: Dict[str, Any], result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect rare, high-value signals that deserve score bonuses."""
    bonuses: List[Dict[str, Any]] = []

    # AI certifications
    certs = profile.get("certifications") or profile.get("certificates") or []
    ai_keywords = ["ai", "machine learning", "deep learning", "data science", "artificial intelligence", "ml", "llm"]
    ai_certs = [c for c in certs if any(kw in str(c).lower() for kw in ai_keywords)]
    if ai_certs:
        bonuses.append({"type": "ai_certifications", "value": 5, "reason": f"{len(ai_certs)} AI-related certification(s)"})

    # Quantified achievements (look for numbers/percentages in experience descriptions)
    experiences = profile.get("experiences") or profile.get("positions") or []
    quantified = 0
    for exp in experiences:
        desc = str(exp.get("description", ""))
        if any(c in desc for c in ["%", "$", "revenue", "increased", "reduced", "saved", "grew"]):
            quantified += 1
    if quantified >= 2:
        bonuses.append({"type": "quantified_achievements", "value": 3, "reason": f"{quantified} quantified achievements"})

    # AI-specific projects
    all_text = str(profile).lower()
    ai_project_signals = ["deployed", "implemented ai", "built ml", "trained model", "prompt engineering", "llm", "gpt", "fine-tuned"]
    if sum(1 for s in ai_project_signals if s in all_text) >= 2:
        bonuses.append({"type": "ai_projects", "value": 4, "reason": "AI/ML project experience detected"})

    return bonuses


def calibrate_score(
    result: Dict[str, Any],
    merged_profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Apply post-LLM calibration to the analysis result.

    Mutates `result` in-place by:
    - Replacing `profile_score` with calibrated value
    - Adding `calibration_metadata` with before/after and breakdown

    Returns the modified result dict.
    """
    profile = merged_profile or {}
    dim_scores = result.get("dimension_scores", {})

    if not isinstance(dim_scores, dict) or not dim_scores:
        logger.warning("No dimension_scores found, skipping calibration")
        return result

    # ── Step 1: Weighted composite from dimension scores ─────────────────
    weighted_sum = 0.0
    weight_total = 0.0
    confidence_penalty_total = 0

    for dim_key, weight in DIMENSION_WEIGHTS.items():
        dim = dim_scores.get(dim_key, {})
        if not isinstance(dim, dict):
            continue
        raw_score = dim.get("score")
        if raw_score is None:
            continue

        try:
            score_val = float(raw_score)
        except (TypeError, ValueError):
            continue

        weighted_sum += score_val * weight
        weight_total += weight

        # Confidence penalty
        confidence = str(dim.get("confidence", "medium")).lower()
        penalty = CONFIDENCE_PENALTY.get(confidence, 1)
        confidence_penalty_total += penalty

        # Evidence penalty
        evidence = dim.get("evidence", [])
        if isinstance(evidence, list) and len(evidence) == 0:
            confidence_penalty_total += 3

    if weight_total == 0:
        logger.warning("No valid dimension scores, skipping calibration")
        return result

    # Scale 1-5 weighted average to 0-100
    raw_composite = (weighted_sum / weight_total) * 20.0
    raw_score = int(round(raw_composite))

    # ── Step 2: Apply sigmoid compression ────────────────────────────────
    calibrated = _sigmoid(raw_composite, center=55.0, steepness=14.0)

    # ── Step 3: Apply confidence & evidence penalties ────────────────────
    calibrated -= confidence_penalty_total

    # ── Step 4: Completeness discount ────────────────────────────────────
    completeness = _calculate_profile_completeness(profile)
    completeness_discount = 0
    if completeness < 0.3:
        completeness_discount = int(calibrated * 0.20)  # 20% penalty
        calibrated -= completeness_discount
    elif completeness < 0.5:
        completeness_discount = int(calibrated * 0.08)  # 8% penalty
        calibrated -= completeness_discount

    # ── Step 5: Differentiation bonuses ──────────────────────────────────
    bonuses = _detect_bonuses(profile, result)
    bonus_total = sum(b["value"] for b in bonuses)
    calibrated += bonus_total

    # Clamp to 0-100
    final_score = max(0, min(100, int(round(calibrated))))

    # ── Step 6: Store calibration metadata ───────────────────────────────
    result["profile_score"] = final_score
    result["calibration_metadata"] = {
        "raw_score": raw_score,
        "calibrated_score": final_score,
        "sigmoid_output": int(round(_sigmoid(raw_composite, center=55.0, steepness=14.0))),
        "confidence_penalty": confidence_penalty_total,
        "completeness": round(completeness, 2),
        "completeness_discount": completeness_discount,
        "bonuses": bonuses,
        "bonus_total": bonus_total,
    }

    logger.info(
        "Score calibration: raw=%d → calibrated=%d (confidence_penalty=%d, completeness=%.2f, bonuses=%d)",
        raw_score, final_score, confidence_penalty_total, completeness, bonus_total,
    )

    return result
