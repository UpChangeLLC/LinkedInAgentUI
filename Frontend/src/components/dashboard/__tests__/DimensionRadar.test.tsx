import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DimensionRadar } from '../DimensionRadar';

const rows = [
  { dimension: 'AI Fluency', score: 8 },
  { dimension: 'Automation Exposure', score: 6 },
  { dimension: 'Learning Velocity', score: 7 },
  { dimension: 'Technical Proximity', score: 5 },
  { dimension: 'Execution Credibility', score: 9 },
  { dimension: 'Leadership Readiness', score: 4 },
  { dimension: 'Governance Awareness', score: 3 },
  { dimension: 'Network Relevance', score: 6 },
];

describe('DimensionRadar', () => {
  it('renders an accessible radar region for the resilience dimensions', () => {
    render(<DimensionRadar data={rows} />);
    expect(screen.getByRole('img', { name: /dimension/i })).toBeTruthy();
  });
});
