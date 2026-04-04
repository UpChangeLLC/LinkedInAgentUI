import { describe, it, expect } from 'vitest';
import { toMockResults } from '../transform';

describe('toMockResults', () => {
  it('returns fallback mock data when given empty input', () => {
    const result = toMockResults(null);
    expect(result).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(result.scoreFactors.length).toBeGreaterThan(0);
    expect(result.personalProfile.name).toBeTruthy();
  });

  it('maps profile_score to score correctly', () => {
    const result = toMockResults({ profile_score: 85 });
    expect(result.score).toBe(85);
  });

  it('maps dimension_scores to scoreFactors correctly', () => {
    const backend = {
      dimension_scores: {
        ai_fluency: { score: 4, rationale: 'Strong AI skills', confidence: 'high', evidence: ['Completed AI course'] },
        technical_proximity: { score: 3, rationale: 'Decent tech background' },
      },
    };
    const result = toMockResults(backend);
    expect(result.scoreFactors.length).toBe(2);

    const aiFluency = result.scoreFactors.find((f) => f.name === 'AI Fluency');
    expect(aiFluency).toBeDefined();
    expect(aiFluency!.value).toBe(80); // 4 * 20
    expect(aiFluency!.explanation).toBe('Strong AI skills');
    expect(aiFluency!.confidence).toBe('high');
    expect(aiFluency!.evidence).toHaveLength(1);
    expect(aiFluency!.evidence![0].text).toBe('Completed AI course');

    const techProx = result.scoreFactors.find((f) => f.name === 'Technical Proximity');
    expect(techProx).toBeDefined();
    expect(techProx!.value).toBe(60); // 3 * 20
  });

  it('maps skill_gap_matrix correctly', () => {
    const backend = {
      skill_gap_matrix: [
        {
          name: 'Prompt Engineering',
          proficiency: 3,
          market_demand: 5,
          category: 'ai-core',
          justification: 'High demand skill',
          learning_resource: 'https://example.com',
        },
        {
          name: 'Python',
          proficiency: 7, // should be clamped to 5
          market_demand: 0, // should be clamped to 1
          category: 'invalid-category', // should fallback to 'foundational'
        },
      ],
    };
    const result = toMockResults(backend);
    expect(result.skillGapMatrix).toHaveLength(2);

    expect(result.skillGapMatrix[0].name).toBe('Prompt Engineering');
    expect(result.skillGapMatrix[0].proficiency).toBe(3);
    expect(result.skillGapMatrix[0].marketDemand).toBe(5);
    expect(result.skillGapMatrix[0].category).toBe('ai-core');

    // Clamped values
    expect(result.skillGapMatrix[1].proficiency).toBe(5);
    expect(result.skillGapMatrix[1].marketDemand).toBe(1);
    expect(result.skillGapMatrix[1].category).toBe('foundational');
  });

  it('maps action_items correctly', () => {
    const backend = {
      action_items: [
        {
          id: 'a1',
          title: 'Learn Python',
          description: 'Start a Python course',
          category: 'learning',
          priority: 'high',
          estimated_hours: 10,
          resource_url: 'https://example.com',
          resource_title: 'Python 101',
        },
        {
          // item with empty title should be filtered out
          title: '   ',
          description: 'empty',
        },
      ],
    };
    const result = toMockResults(backend);
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0].id).toBe('a1');
    expect(result.actionItems[0].title).toBe('Learn Python');
    expect(result.actionItems[0].category).toBe('learning');
    expect(result.actionItems[0].priority).toBe('high');
    expect(result.actionItems[0].estimatedHours).toBe(10);
    expect(result.actionItems[0].status).toBe('pending');
    expect(result.actionItems[0].completedAt).toBeNull();
  });

  it('maps score_delta correctly', () => {
    const backend = {
      score_delta: {
        previous_score: 50,
        score_delta: 13,
        previous_risk_band: 'High Risk',
        days_since_last: 30,
        dimension_deltas: { ai_fluency: 5 },
        previous_assessment_date: '2025-01-01',
      },
    };
    const result = toMockResults(backend);
    expect(result.scoreDelta).toBeDefined();
    expect(result.scoreDelta!.previousScore).toBe(50);
    expect(result.scoreDelta!.scoreDelta).toBe(13);
    expect(result.scoreDelta!.previousRiskBand).toBe('High Risk');
    expect(result.scoreDelta!.daysSinceLast).toBe(30);
    expect(result.scoreDelta!.dimensionDeltas).toEqual({ ai_fluency: 5 });
    expect(result.scoreDelta!.previousAssessmentDate).toBe('2025-01-01');
  });

  it('returns null scoreDelta when not provided', () => {
    const result = toMockResults({});
    expect(result.scoreDelta).toBeNull();
  });
});
