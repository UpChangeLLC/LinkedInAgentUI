import { useEffect, useRef, useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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

/** Session rail for the Career Mentor: New chat, search, and a list of saved
 *  threads. Row actions live behind a kebab (⋯) menu so they never overlap the
 *  title (the title reserves right padding and truncates cleanly). */
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
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasActions = Boolean(onRename || onDelete);

  // Close the kebab menu on outside-click / Escape.
  useEffect(() => {
    if (!menuId) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  const filtered = query.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const startRename = (s: CareerChatSessionSummary) => {
    setMenuId(null);
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
          <li className="px-3 py-8 text-center text-xs text-dark-textMuted">
            {query.trim() ? 'No chats match your search.' : 'No saved chats yet.'}
          </li>
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
                  // pr-9 reserves room for the ⋯ trigger so titles never overlap it
                  'w-full flex items-center rounded-lg pl-2.5 pr-9 py-2 min-h-[44px] text-left transition',
                  active
                    ? 'bg-dark-accentDim text-dark-accent border-l-2 border-dark-accent'
                    : 'text-dark-textSec hover:bg-dark-elevated hover:text-dark-textPri',
                )}
              >
                <span className="truncate block w-full">{s.title}</span>
              </button>

              {hasActions && (
                <div
                  ref={menuId === s.session_id ? menuRef : undefined}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <button
                    type="button"
                    aria-label={`Chat options for ${s.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuId === s.session_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(menuId === s.session_id ? null : s.session_id);
                    }}
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-md text-dark-textMuted transition',
                      'hover:bg-dark-border/40 hover:text-dark-textPri focus:outline-none focus:ring-2 focus:ring-dark-accent/40',
                      'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                      menuId === s.session_id && 'opacity-100',
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuId === s.session_id && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-1 w-36 overflow-hidden rounded-lg border border-dark-border bg-dark-card py-1 shadow-xl z-20"
                    >
                      {onRename && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => startRename(s)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark-textSec hover:bg-dark-elevated hover:text-dark-textPri"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Rename
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuId(null);
                            onDelete(s.session_id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark-red hover:bg-dark-red/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
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
