import { describe, it, expect } from 'vitest';
import {
  surveyResponseSchema,
  isSurveyComplete,
  REQUIRED_QUESTION_IDS,
  type SurveyResponse,
} from '../survey';

const valid: SurveyResponse = {
  q_ai_1: { chatgpt: 'daily', claude: 'weekly' },
  q_ai_2: 'Drafting emails',
  q_ga_1: 'sometimes',
  q_lv_1: '3-5',
  q_lv_2: 4,
  q_nr_1: 3,
  q_nr_2: 'occasionally',
  q_ae_1: 35,
  q_rw_2: 'no',
};

describe('surveyResponseSchema', () => {
  it('accepts a valid full response', () => {
    expect(surveyResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts when optional fields are omitted', () => {
    const { q_ai_2, q_rw_2, ...rest } = valid;
    expect(surveyResponseSchema.safeParse(rest).success).toBe(true);
  });

  it('rejects an out-of-range likert value', () => {
    expect(surveyResponseSchema.safeParse({ ...valid, q_lv_2: 9 }).success).toBe(false);
  });

  it('rejects q_ae_1 above 100', () => {
    expect(surveyResponseSchema.safeParse({ ...valid, q_ae_1: 150 }).success).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    expect(surveyResponseSchema.safeParse({ ...valid, q_ga_1: 'maybe' }).success).toBe(false);
  });

  it('rejects q_ai_2 longer than 140 chars', () => {
    expect(surveyResponseSchema.safeParse({ ...valid, q_ai_2: 'x'.repeat(141) }).success).toBe(false);
  });
});

describe('isSurveyComplete', () => {
  it('true when all required answered', () => {
    expect(isSurveyComplete(valid)).toBe(true);
  });

  it('false when a required field is missing', () => {
    const partial = { ...valid };
    delete (partial as any).q_ga_1;
    expect(isSurveyComplete(partial)).toBe(false);
  });

  it('true even when only optional fields are missing', () => {
    const partial = { ...valid };
    delete (partial as any).q_ai_2;
    delete (partial as any).q_rw_2;
    expect(isSurveyComplete(partial)).toBe(true);
  });

  it('exposes the required question ids', () => {
    expect(REQUIRED_QUESTION_IDS).toContain('q_ai_1');
    expect(REQUIRED_QUESTION_IDS).not.toContain('q_ai_2');
  });
});
