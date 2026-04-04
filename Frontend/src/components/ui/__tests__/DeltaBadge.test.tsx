import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeltaBadge } from '../DeltaBadge';

describe('DeltaBadge', () => {
  it('renders positive delta with green styling and + prefix', () => {
    const { container } = render(<DeltaBadge delta={12} />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toContain('+');
    expect(badge.textContent).toContain('12');
    expect(badge.className).toContain('text-dark-green');
    expect(badge.className).toContain('bg-dark-green/10');
  });

  it('renders negative delta with red styling', () => {
    const { container } = render(<DeltaBadge delta={-5} />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toContain('-5');
    expect(badge.className).toContain('text-dark-red');
    expect(badge.className).toContain('bg-dark-red/10');
  });

  it('renders zero delta with neutral styling', () => {
    const { container } = render(<DeltaBadge delta={0} />);
    const badge = container.querySelector('span')!;
    expect(badge.textContent).toContain('0');
    expect(badge.className).toContain('text-dark-textMuted');
    expect(badge.className).toContain('bg-dark-elevated');
  });

  it('renders label when provided', () => {
    render(<DeltaBadge delta={3} label="pts" />);
    expect(screen.getByText('pts')).toBeInTheDocument();
  });
});
