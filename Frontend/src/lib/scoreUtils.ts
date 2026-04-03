/** Unified score color logic used across ScoreGauge, ScoreReveal, RecentlyAssessedTicker. */

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600 bg-green-50';
  if (score >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export function getScoreGradient(score: number): string {
  if (score >= 75) return 'from-green-400 to-emerald-500';
  if (score >= 50) return 'from-amber-400 to-orange-500';
  return 'from-red-400 to-rose-500';
}

export function getScoreBand(score: number): string {
  if (score >= 75) return 'Low Risk';
  if (score >= 50) return 'Moderate Risk';
  return 'High Risk';
}
