import { describe, it, expect } from 'vitest';
import { rerunNote } from '../dashboardCopy';

describe('rerunNote', () => {
  it('free tier shows the 30-day limit and the premium upsell clause', () => {
    const note = rerunNote('free');
    expect(note).toContain('Computed just now');
    expect(note).toContain('30 days');
    expect(note).toContain('(free)');
    expect(note).toContain('Premium');
  });

  it('premium tier drops the free/30-day clause and offers re-run anytime', () => {
    const note = rerunNote('premium');
    expect(note).toContain('Computed just now');
    expect(note).not.toContain('30 days');
    expect(note).not.toContain('(free)');
    expect(note.toLowerCase()).toContain('anytime');
  });
});
