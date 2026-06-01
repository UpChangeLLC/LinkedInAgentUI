export type Tier = 'free' | 'premium';

/**
 * Caption shown under the resilience-score title. Free users see the 30-day
 * re-run limit and the premium upsell; premium users can re-run anytime.
 */
export function rerunNote(tier: Tier): string {
  return tier === 'premium'
    ? 'Computed just now · Re-run anytime'
    : 'Computed just now · Re-run available in 30 days (free) or anytime (Premium)';
}
