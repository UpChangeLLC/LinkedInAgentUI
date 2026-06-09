import { useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CareerChatSessionSummary } from '../../lib/careerChat';

export interface ChatSessionSidebarProps {
  sessions: CareerChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onRename?: (sessionId: string, title: string) => void;
  onDelete?: (sessionId: string) => void;
}

/** Session rail for the Career Mentor — mirrors the approved mockup: New chat,
 *  search, a list of saved threads with active state + hover actions. */
export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: ChatSessionSidebarProps) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const filtered = query.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const startRename = (s: CareerChatSessionSummary) => {
    setEditingId(s.session_id);
    setDraft(s.title);
  };
  const commitRename = (sid: string) => {
    const title = draft.trim();
    if (title) onRename?.(sid, title);
    setEditingId(null);
  };

  return (
    <nav
      aria-label="Chat sessions"
      className="flex w-64 shrink-0 flex-col bg-dark-card border-r border-dark-border"
    >
      <div className="p-3 border-b border-dark-border">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-dark-accent text-white text-sm font-semibold py-2.5 min-h-[44px] hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> New chat
        </button>
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dark-textMuted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full rounded-lg bg-dark-elevated border border-dark-border pl-8 pr-3 py-2 text-xs text-dark-textPri placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
        {filtered.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-dark-textMuted">No saved chats yet</li>
        )}
        {filtered.map((s) => {
          const active = s.session_id === activeSessionId;
          if (editingId === s.session_id) {
            return (
              <li key={s.session_id}>
                <input
                  autoFocus
                  aria-label="Rename chat"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(s.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.session_id);
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full rounded-lg bg-dark-elevated border border-dark-accent px-2.5 py-2 min-h-[44px] text-sm text-dark-textPri focus:outline-none focus:ring-2 focus:ring-dark-accent/40"
                />
              </li>
            );
          }
          return (
            <li key={s.session_id} className="group relative">
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(s.session_id)}
                className={clsx(
                  'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 min-h-[44px] text-left transition',
                  active
                    ? 'bg-dark-accentDim text-dark-accent border-l-2 border-dark-accent'
                    : 'text-dark-textSec hover:bg-dark-elevated hover:text-dark-textPri',
                )}
              >
                <span className="truncate flex-1">{s.title}</span>
              </button>
              {(onRename || onDelete) && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                  {onRename && (
                    <button
                      type="button"
                      aria-label={`Rename ${s.title}`}
                      onClick={() => startRename(s)}
                      className="p-1.5 rounded text-dark-textMuted hover:text-dark-accent"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      aria-label={`Delete ${s.title}`}
                      onClick={() => onDelete(s.session_id)}
                      className="p-1.5 rounded text-dark-textMuted hover:text-dark-red"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ChatSessionSidebar;
