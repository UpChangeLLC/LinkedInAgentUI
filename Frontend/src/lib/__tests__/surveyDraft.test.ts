import { describe, it, expect, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft } from '../surveyDraft';

describe('surveyDraft', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a saved draft for the same run id', () => {
    saveDraft('run-1', { q_ga_1: 'yes' });
    saveDraft('run-1', { q_lv_2: 4 });
    const draft = loadDraft('run-1');
    expect(draft?.responses.q_ga_1).toBe('yes');
    expect(draft?.responses.q_lv_2).toBe(4);
  });

  it('returns null for a mismatched run id', () => {
    saveDraft('run-1', { q_ga_1: 'yes' });
    expect(loadDraft('run-2')).toBeNull();
  });

  it('returns null when nothing is saved', () => {
    expect(loadDraft('run-1')).toBeNull();
  });

  it('expires drafts older than the TTL', () => {
    saveDraft('run-1', { q_ga_1: 'yes' });
    const raw = JSON.parse(localStorage.getItem('upchange.survey.draft')!);
    raw.timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days old
    localStorage.setItem('upchange.survey.draft', JSON.stringify(raw));
    expect(loadDraft('run-1')).toBeNull();
  });

  it('clears the draft', () => {
    saveDraft('run-1', { q_ga_1: 'yes' });
    clearDraft();
    expect(loadDraft('run-1')).toBeNull();
  });
});
