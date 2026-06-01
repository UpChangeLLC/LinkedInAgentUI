import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PremiumTeaser } from '../PremiumTeaser';

describe('PremiumTeaser', () => {
  it('renders children directly for premium tier', () => {
    render(
      <PremiumTeaser tier="premium" title="Roadmap" teaser="x">
        <div>real content</div>
      </PremiumTeaser>,
    );
    expect(screen.getByText('real content')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });

  it('renders a locked teaser with CTA for free tier', () => {
    render(
      <PremiumTeaser tier="free" title="Roadmap" teaser="10 actions waiting">
        <div>real content</div>
      </PremiumTeaser>,
    );
    expect(screen.getByText('10 actions waiting')).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
  });

  it('exposes an accessible premium label for screen readers', () => {
    const { container } = render(
      <PremiumTeaser tier="free" title="Roadmap" teaser="x">
        <div>real content</div>
      </PremiumTeaser>,
    );
    expect(container.querySelector('[aria-label="Premium content — sign up to unlock"]')).toBeTruthy();
  });

  it('fires onUnlock when the CTA is clicked', () => {
    const onUnlock = vi.fn();
    render(
      <PremiumTeaser tier="free" title="Roadmap" teaser="x" onUnlock={onUnlock} sourceSection="roadmap">
        <div>real content</div>
      </PremiumTeaser>,
    );
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }));
    expect(onUnlock).toHaveBeenCalledWith('roadmap');
  });
});
