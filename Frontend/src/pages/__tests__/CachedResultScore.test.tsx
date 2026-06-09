import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CachedResultPromptPage } from '../CachedResultPromptPage';

const baseProps = {
  age: null,
  onViewCached: vi.fn(),
  onRunFresh: vi.fn(),
};

describe('CachedResultPromptPage "Saved score"', () => {
  it('shows the v1 resilience_score (not the legacy profile_score) so it matches the dashboard', () => {
    render(<CachedResultPromptPage {...baseProps} result={{ resilience_score: 37, profile_score: 85 }} />);
    expect(screen.getByText('37')).toBeInTheDocument();
    expect(screen.queryByText('85')).not.toBeInTheDocument();
  });

  it('falls back to profile_score when no v1 score is present', () => {
    render(<CachedResultPromptPage {...baseProps} result={{ profile_score: 72 }} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });
});
