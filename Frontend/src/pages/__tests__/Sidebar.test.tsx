import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../ResultsDashboard';

function renderSidebar(tier: 'free' | 'premium', overrides: Record<string, any> = {}) {
  const props = {
    tier,
    activeSection: 'overview' as const,
    onSelect: vi.fn(),
    onAnchor: vi.fn(),
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

  it('premium: Career pathways routes to the pathways section', () => {
    const props = renderSidebar('premium');
    fireEvent.click(screen.getByRole('button', { name: /Career pathways/i }));
    expect(props.onSelect).toHaveBeenCalledWith('pathways');
  });

  it('"Your score" / "Dim breakdown" / "History" scroll to their overview anchors', () => {
    const props = renderSidebar('premium');
    fireEvent.click(screen.getByRole('button', { name: /Your score/i }));
    expect(props.onAnchor).toHaveBeenCalledWith('overview-score');
    fireEvent.click(screen.getByRole('button', { name: /Dim breakdown/i }));
    expect(props.onAnchor).toHaveBeenCalledWith('overview-dimensions');
    fireEvent.click(screen.getByRole('button', { name: /History/i }));
    expect(props.onAnchor).toHaveBeenCalledWith('overview-history');
  });

  it('free: a service item opens the upsell instead of navigating', () => {
    const props = renderSidebar('free');
    fireEvent.click(screen.getByRole('button', { name: /Skill gap matrix/i }));
    expect(props.onUpsell).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

describe('Sidebar community link (Workstream D)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a Community link to VITE_COMMUNITY_URL opening safely in a new tab', () => {
    vi.stubEnv('VITE_COMMUNITY_URL', 'https://community.upchange.ai');
    renderSidebar('premium');
    const link = screen.getByRole('link', { name: /community/i });
    expect(link).toHaveAttribute('href', 'https://community.upchange.ai');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('shows the Community link for free-tier users too (external, not gated)', () => {
    vi.stubEnv('VITE_COMMUNITY_URL', 'https://community.upchange.ai');
    renderSidebar('free');
    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument();
  });

  it('hides the Community link when VITE_COMMUNITY_URL is unset (no dead link)', () => {
    vi.stubEnv('VITE_COMMUNITY_URL', '');
    renderSidebar('premium');
    expect(screen.queryByRole('link', { name: /community/i })).not.toBeInTheDocument();
  });
});
