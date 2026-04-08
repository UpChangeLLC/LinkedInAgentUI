import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyzingPage } from '../AnalyzingPage';
import type { PipelineProgress } from '../../hooks/useAppState';

const baseProgress: PipelineProgress = {
  progress: 52,
  currentNode: 'extract_profiles_node',
  message: 'Extracting Skills & Experience',
  events: [
    {
      event_type: 'node_complete',
      node: 'validate_input_node',
      status: 'success',
      progress: 15,
      info: 'Validated',
      duration_ms: 250,
      data_points: 1,
      partial_result: {},
    },
    {
      event_type: 'node_complete',
      node: 'fetch_sources_node',
      status: 'success',
      progress: 32,
      info: 'Fetched',
      duration_ms: 1200,
      data_points: 9200,
      partial_result: {},
    },
  ],
  partialData: {
    name: 'Avery Quinn',
    title: 'VP Product',
    skills_count: 12,
  },
  elapsedMs: 18_000,
};

describe('AnalyzingPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network-offline')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders hybrid status rail with elapsed and step counts', () => {
    render(
      <AnalyzingPage
        pipelineProgress={baseProgress}
        completionPhase="streaming"
      />
    );

    expect(screen.getByText('Elapsed')).toBeInTheDocument();
    expect(screen.getByText('18s')).toBeInTheDocument();
    expect(screen.getByText('Steps')).toBeInTheDocument();
    expect(screen.getByText('2/6')).toBeInTheDocument();
    expect(screen.getAllByText('Extracting Skills & Experience').length).toBeGreaterThan(0);
  });

  it('shows completion reveal status when result is ready', () => {
    render(
      <AnalyzingPage
        pipelineProgress={{ ...baseProgress, progress: 100 }}
        completionPhase="result_ready"
      />
    );

    expect(screen.getByText('Your report is ready')).toBeInTheDocument();
    expect(screen.getByText('Preparing your dashboard...')).toBeInTheDocument();
  });
});
