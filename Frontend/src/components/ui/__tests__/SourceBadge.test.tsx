import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SourceBadge } from '../SourceBadge';

describe('SourceBadge', () => {
  it('renders linkedin badge with correct label and styling', () => {
    const { container } = render(<SourceBadge source="linkedin" />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toBe('LinkedIn');
    expect(badge.className).toContain('text-blue-700');
    expect(badge.getAttribute('title')).toContain('LinkedIn');
  });

  it('renders resume badge', () => {
    const { container } = render(<SourceBadge source="resume" />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toBe('Resume');
    expect(badge.className).toContain('text-green-700');
  });

  it('renders ai_inferred badge', () => {
    const { container } = render(<SourceBadge source="ai_inferred" />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toBe('AI Inferred');
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders market_data badge', () => {
    const { container } = render(<SourceBadge source="market_data" />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toBe('Market Data');
    expect(badge.className).toContain('text-purple-700');
  });
});
