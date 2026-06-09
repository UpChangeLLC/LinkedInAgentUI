import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '../Logo';

describe('Logo', () => {
  it('full variant renders an accessible SVG with the UPCHANGE wordmark and tagline', () => {
    const { container } = render(<Logo variant="full" />);
    expect(screen.getByRole('img', { name: /upchange/i })).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).toContain('UPCHANGE');
    expect(container.textContent).toMatch(/Individuals with AI/i);
  });

  it('compact variant has the UPCHANGE wordmark but drops the tagline', () => {
    const { container } = render(<Logo variant="compact" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).toContain('UPCHANGE');
    expect(container.textContent).not.toMatch(/Individuals with AI/i);
  });

  it('mark variant renders the icon only (no wordmark text)', () => {
    const { container } = render(<Logo variant="mark" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).not.toContain('UPCHANGE');
  });

  it('uses currentColor so it adapts to the surface (no hardcoded fills)', () => {
    const { container } = render(<Logo variant="mark" />);
    expect(container.innerHTML).toContain('currentColor');
    expect(container.innerHTML).not.toContain('object-cover');
  });

  it('applies a size-based height class', () => {
    const { container } = render(<Logo variant="compact" size="sm" />);
    expect(container.querySelector('.h-6')).toBeTruthy();
  });
});
