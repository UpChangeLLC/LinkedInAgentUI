import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalRoadmapSection } from '../PersonalRoadmapSection';
import { CareerPathwaysSection } from '../CareerPathwaysSection';
import { mockResults } from '../../../data/mockResults';

describe('Dashboard section CTAs navigate (no dead ends)', () => {
  it('PersonalRoadmap "View Resources & Action Plan" calls onViewResources', () => {
    const onViewResources = vi.fn();
    render(<PersonalRoadmapSection results={mockResults} onViewResources={onViewResources} />);
    fireEvent.click(screen.getAllByRole('button', { name: /view resources & action plan/i })[0]);
    expect(onViewResources).toHaveBeenCalledTimes(1);
  });

  it('CareerPathways path CTA calls onExplorePath', () => {
    const onExplorePath = vi.fn();
    const pathways = [
      {
        name: 'AI Product Manager',
        description: 'Lead AI-powered products.',
        requiredSkills: ['LLMs', 'Evals'],
        timelineMonths: 6,
        difficulty: 'moderate' as const,
        salaryImpact: '+20%',
        recommended: true,
      },
    ];
    render(<CareerPathwaysSection pathways={pathways} currentRole="Founder" onExplorePath={onExplorePath} />);
    // expand the first pathway card to reveal its CTA
    fireEvent.click(screen.getByText('AI Product Manager'));
    fireEvent.click(screen.getByRole('button', { name: /see the skills to get there/i }));
    expect(onExplorePath).toHaveBeenCalledTimes(1);
  });
});
