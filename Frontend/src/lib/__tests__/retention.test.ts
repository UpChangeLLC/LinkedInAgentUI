import { describe, it, expect } from 'vitest';
import { trajectoryCaption, type TrajectoryEntry } from '../retention';

const e = (computed_at: string, resilience: number, delta: number | null = null, dim: string | null = null): TrajectoryEntry => ({
  run_id: computed_at,
  computed_at,
  resilience_score: resilience,
  readiness_score: resilience,
  delta_from_previous: delta,
  top_change_dim: dim,
});

describe('trajectoryCaption', () => {
  it('returns null for fewer than 2 points', () => {
    expect(trajectoryCaption([e('2026-04-01', 68)])).toBeNull();
    expect(trajectoryCaption([])).toBeNull();
  });

  it('summarizes a positive trajectory with the top dimension', () => {
    const caption = trajectoryCaption([
      e('2026-04-01T00:00:00Z', 68),
      e('2026-05-01T00:00:00Z', 74, 6, 'learning_velocity'),
    ]);
    expect(caption).toContain('+6');
    expect(caption?.toLowerCase()).toContain('learning velocity');
  });

  it('handles a decline without a top dim', () => {
    const caption = trajectoryCaption([
      e('2026-04-01T00:00:00Z', 74),
      e('2026-05-01T00:00:00Z', 70, -4, null),
    ]);
    expect(caption).toContain('-4');
  });
});
