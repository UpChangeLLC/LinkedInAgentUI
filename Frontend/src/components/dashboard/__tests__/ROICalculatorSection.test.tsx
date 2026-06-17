import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ROICalculatorSection } from '../ROICalculatorSection';

describe('ROICalculatorSection', () => {
  it('renders without crashing', () => {
    const { container } = render(<ROICalculatorSection />);
    expect(container).toBeTruthy();
  });

  it('renders the heading', () => {
    render(<ROICalculatorSection />);
    expect(screen.getByText('Workflow ROI Calculator')).toBeInTheDocument();
  });

  it('shows default values in initial state', () => {
    render(<ROICalculatorSection />);
    // Default "Adjust Parameters" heading is present
    expect(screen.getByText('Adjust Parameters')).toBeInTheDocument();
    // Default labels
    expect(screen.getByText('Hours/week on manual tasks')).toBeInTheDocument();
    expect(screen.getByText('Expected automation %')).toBeInTheDocument();
    expect(screen.getByText('Hours recovered/year')).toBeInTheDocument();
    expect(screen.getByText('Months payback')).toBeInTheDocument();
    expect(screen.getByText('Cost reduction')).toBeInTheDocument();
  });

  it('renders with workflow items', () => {
    const items = [
      {
        name: 'Reporting',
        explanation: 'Automate reports',
        firstStep: 'Connect BI',
        estimatedSavings: '$10k/yr',
        currentPainPoint: 'Manual synthesis',
        automationPercentage: 60,
      },
    ];
    render(<ROICalculatorSection workflowItems={items} />);
    expect(screen.getByText(/Default automation % is derived/)).toBeInTheDocument();
  });
});
