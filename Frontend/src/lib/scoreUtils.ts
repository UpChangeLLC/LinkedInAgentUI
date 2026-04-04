/** Unified score color logic used across ScoreGauge, ScoreReveal, RecentlyAssessedTicker. */

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-dark-green bg-dark-green/10';
  if (score >= 50) return 'text-dark-amber bg-dark-amber/10';
  return 'text-dark-red bg-dark-red/10';
}

export function getScoreGradient(score: number): string {
  if (score >= 75) return 'from-emerald-400 to-teal-500';
  if (score >= 50) return 'from-amber-400 to-orange-500';
  return 'from-red-400 to-rose-500';
}

export function getScoreBand(score: number): string {
  if (score >= 75) return 'Low Risk';
  if (score >= 50) return 'Moderate Risk';
  return 'High Risk';
}
