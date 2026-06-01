import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../ResultsDashboard';

function renderSidebar(tier: 'free' | 'premium', overrides: Record<string, any> = {}) {
  const props = {
    tier,
    activeSection: 'overview' as const,
    onSelect: vi.fn(),
    onUpsell: vi.fn(),
    onOpenCareerMentor: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar navigation', () => {
  it('premium: a service item routes via onSelect with its section key', () => {
    const props = renderSidebar('premium');
    fireEvent.click(screen.getByRole('button', { name: /Skill gap matrix/i }));
    expect(props.onSelect).toHaveBeenCalledWith('skills');
    expect(props.onUpsell).not.toHaveBeenCalled();
  });

  it('premium: Career mentor opens the chat page via onOpenCareerMentor', () => {
    const props = renderSidebar('premium');
    fireEvent.click(screen.getByRole('button', { name: /Career mentor/i }));
    expect(props.onOpenCareerMentor).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalledWith('overview');
  });

  it('premium: Overview returns to the overview section', () => {
    const props = renderSidebar('premium');
    fireEvent.click(screen.getByRole('button', { name: /Overview/i }));
    expect(props.onSelect).toHaveBeenCalledWith('overview');
  });

  it('free: a service item opens the upsell instead of navigating', () => {
    const props = renderSidebar('free');
    fireEvent.click(screen.getByRole('button', { name: /Skill gap matrix/i }));
    expect(props.onUpsell).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
