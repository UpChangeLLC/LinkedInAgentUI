import { describe, it, expect } from 'vitest';
import { mockResults } from '../mockResults';

describe('mockResults', () => {
  it('has all required top-level fields', () => {
    expect(mockResults).toHaveProperty('score');
    expect(mockResults).toHaveProperty('riskBand');
    expect(mockResults).toHaveProperty('executiveBrief');
    expect(mockResults).toHaveProperty('scoreFactors');
    expect(mockResults).toHaveProperty('workflowItems');
    expect(mockResults).toHaveProperty('leverageItems');
    expect(mockResults).toHaveProperty('governanceItems');
    expect(mockResults).toHaveProperty('planItems');
    expect(mockResults).toHaveProperty('personalProfile');
    expect(mockResults).toHaveProperty('personalRisk');
    expect(mockResults).toHaveProperty('industryContext');
    expect(mockResults).toHaveProperty('competitorIntel');
    expect(mockResults).toHaveProperty('industryBenchmarks');
    expect(mockResults).toHaveProperty('skillGapMatrix');
    expect(mockResults).toHaveProperty('disruptionTimeline');
    expect(mockResults).toHaveProperty('actionItems');
  });

  it('has score as a number', () => {
    expect(typeof mockResults.score).toBe('number');
    expect(mockResults.score).toBeGreaterThanOrEqual(0);
    expect(mockResults.score).toBeLessThanOrEqual(100);
  });

  it('has non-empty scoreFactors', () => {
    expect(Array.isArray(mockResults.scoreFactors)).toBe(true);
    expect(mockResults.scoreFactors.length).toBeGreaterThan(0);

    const first = mockResults.scoreFactors[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('value');
    expect(first).toHaveProperty('weight');
  });
});
