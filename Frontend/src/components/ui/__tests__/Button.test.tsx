import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows a spinner, is disabled, and marks aria-busy when loading', () => {
    const { container } = render(<Button loading>Pay</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('does not render a spinner when not loading', () => {
    const { container } = render(<Button>Pay</Button>);
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('does not fire onClick while loading', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
