import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatSessionSidebar } from '../ChatSessionSidebar';

const SESSIONS = [
  { session_id: 'a1', title: '30-day action plan', last_message_at: null },
  { session_id: 'b2', title: 'Pivot to AI PM', last_message_at: null },
];

function setup(overrides: Record<string, any> = {}) {
  const props = {
    sessions: SESSIONS,
    activeSessionId: 'a1',
    onSelect: vi.fn(),
    onNewChat: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<ChatSessionSidebar {...props} />);
  return props;
}

describe('ChatSessionSidebar', () => {
  it('renders thread titles inside a semantic nav', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: /chat sessions/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('30-day action plan')).toBeInTheDocument();
    expect(screen.getByText('Pivot to AI PM')).toBeInTheDocument();
  });

  it('marks the active thread with aria-current', () => {
    setup();
    const active = screen.getByRole('button', { name: '30-day action plan' });
    expect(active).toHaveAttribute('aria-current', 'true');
    const other = screen.getByRole('button', { name: 'Pivot to AI PM' });
    expect(other).not.toHaveAttribute('aria-current', 'true');
  });

  it('selecting a thread calls onSelect with its session_id', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pivot to AI PM' }));
    expect(props.onSelect).toHaveBeenCalledWith('b2');
  });

  it('New chat button calls onNewChat', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));
    expect(props.onNewChat).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when there are no sessions', () => {
    setup({ sessions: [], activeSessionId: null });
    expect(screen.getByText(/no saved chats/i)).toBeInTheDocument();
  });

  it('actions live behind a kebab menu (not overlapping the title)', () => {
    setup();
    // Rename/Delete are not visible until the ⋯ menu is opened.
    expect(screen.queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /chat options for 30-day action plan/i }));
    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('inline-renames via the menu: Rename reveals a textbox; Enter commits onRename(sid, title)', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /chat options for 30-day action plan/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /rename chat/i });
    expect(input).toHaveValue('30-day action plan');
    fireEvent.change(input, { target: { value: 'My renamed plan' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('a1', 'My renamed plan');
  });

  it('inline-rename cancels on Escape without calling onRename', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /chat options for 30-day action plan/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /rename chat/i });
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /rename chat/i })).not.toBeInTheDocument();
  });

  it('Delete menu item calls onDelete with the session id', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /chat options for pivot to ai pm/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
    expect(props.onDelete).toHaveBeenCalledWith('b2');
  });
});
