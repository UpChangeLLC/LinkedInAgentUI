import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Users,
  Briefcase,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Card } from '../ui/Card';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'learning' | 'networking' | 'projects' | 'governance';
  priority: 'high' | 'medium' | 'low';
  estimated_hours: number;
  resource_url: string;
  resource_title: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: string | null;
}

interface ActionTrackerSectionProps {
  urlHash: string;
  /** Fallback action items from the analysis result (used when DB is unavailable) */
  fallbackActions?: ActionItem[];
}

const CATEGORY_CONFIG = {
  learning: { icon: BookOpen, label: 'Learning', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  networking: { icon: Users, label: 'Networking', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  projects: { icon: Briefcase, label: 'Projects', color: 'text-dark-green bg-dark-green/10 border-dark-green/20' },
  governance: { icon: Shield, label: 'Governance', color: 'text-dark-amber bg-dark-amber/10 border-dark-amber/20' },
};

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-dark-red/10 text-dark-red' },
  medium: { label: 'Medium', color: 'bg-dark-amber/10 text-dark-amber' },
  low: { label: 'Low', color: 'bg-dark-green/10 text-dark-green' },
};

const STATUS_CONFIG = {
  pending: { icon: Circle, label: 'To Do', color: 'text-dark-textMuted' },
  in_progress: { icon: Clock, label: 'In Progress', color: 'text-blue-500' },
  completed: { icon: CheckCircle2, label: 'Done', color: 'text-green-500' },
};

const BASE_URL = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

export function ActionTrackerSection({ urlHash, fallbackActions = [] }: ActionTrackerSectionProps) {
  const [actions, setActions] = useState<ActionItem[]>(fallbackActions);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  // Fetch actions from API
  const fetchActions = useCallback(async () => {
    if (!urlHash) {
      setActions(fallbackActions);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/actions/${urlHash}`);
      if (res.ok) {
        const data = await res.json();
        if (data.actions?.length > 0) {
          setActions(data.actions);
        } else {
          setActions(fallbackActions);
        }
      } else {
        setActions(fallbackActions);
      }
    } catch {
      setActions(fallbackActions);
    }
    setLoading(false);
  }, [urlHash, fallbackActions]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Update action status
  const updateStatus = async (actionId: string, newStatus: string) => {
    setUpdating((prev) => new Set(prev).add(actionId));
    try {
      const res = await fetch(`${BASE_URL}/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActions((prev) =>
          prev.map((a) =>
            a.id === actionId
              ? {
                  ...a,
                  status: newStatus as any,
                  completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
                }
              : a
          )
        );
      }
    } catch {
      // Silently fail — local state already reflects intent
    }
    setUpdating((prev) => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  };

  // Cycle through statuses
  const cycleStatus = (action: ActionItem) => {
    const order = ['pending', 'in_progress', 'completed'];
    const idx = order.indexOf(action.status);
    const next = order[(idx + 1) % order.length];
    updateStatus(action.id, next);
  };

  const filteredActions =
    filterCategory === 'all' ? actions : actions.filter((a) => a.category === filterCategory);

  const completedCount = actions.filter((a) => a.status === 'completed').length;
  const progressPct = actions.length > 0 ? Math.round((completedCount / actions.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-dark-textMuted" />
        <span className="ml-2 text-dark-textMuted">Loading action items...</span>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-dark-textMuted">No action items generated for this assessment.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-dark-textSec">
            Overall Progress
          </span>
          <span className="text-sm font-bold text-dark-textPri">
            {completedCount} / {actions.length} completed
          </span>
        </div>
        <div className="h-3 bg-dark-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-dark-textMuted mt-1">{progressPct}% complete</p>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <FilterPill
          label="All"
          active={filterCategory === 'all'}
          onClick={() => setFilterCategory('all')}
          count={actions.length}
        />
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const count = actions.filter((a) => a.category === key).length;
          if (count === 0) return null;
          return (
            <FilterPill
              key={key}
              label={cfg.label}
              active={filterCategory === key}
              onClick={() => setFilterCategory(key)}
              count={count}
            />
          );
        })}
      </div>

      {/* Action Items List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredActions.map((action) => {
            const cat = CATEGORY_CONFIG[action.category] || CATEGORY_CONFIG.learning;
            const pri = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.medium;
            const stat = STATUS_CONFIG[action.status] || STATUS_CONFIG.pending;
            const StatusIcon = stat.icon;
            const CatIcon = cat.icon;
            const isExpanded = expandedId === action.id;
            const isUpdating = updating.has(action.id);

            return (
              <motion.div
                key={action.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card
                  className={`p-4 transition-all ${
                    action.status === 'completed' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status toggle button */}
                    <button
                      onClick={() => cycleStatus(action)}
                      disabled={isUpdating}
                      className={`mt-0.5 flex-shrink-0 transition-colors ${stat.color} hover:opacity-70`}
                      title={`Status: ${stat.label}. Click to change.`}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <StatusIcon className="w-5 h-5" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold ${
                            action.status === 'completed'
                              ? 'line-through text-dark-textMuted'
                              : 'text-dark-textPri'
                          }`}
                        >
                          {action.title}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cat.color}`}>
                          <CatIcon className="w-3 h-3 inline mr-0.5" />
                          {cat.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pri.color}`}>
                          {pri.label}
                        </span>
                      </div>

                      {/* Expandable details */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : action.id)}
                        className="mt-1 text-xs text-dark-textMuted hover:text-dark-textSec flex items-center gap-0.5"
                      >
                        {isExpanded ? (
                          <>
                            Less details <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            More details <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 pt-2 border-t border-dark-border space-y-2">
                              {action.description && (
                                <p className="text-xs text-dark-textSec">{action.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-dark-textMuted">
                                {action.estimated_hours > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    ~{action.estimated_hours}h effort
                                  </span>
                                )}
                              </div>
                              {action.resource_url && (
                                <a
                                  href={action.resource_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-dark-accent hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {action.resource_title || 'View Resource'}
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Time estimate badge */}
                    {action.estimated_hours > 0 && !isExpanded && (
                      <span className="text-[10px] text-dark-textMuted flex-shrink-0">
                        ~{action.estimated_hours}h
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-dark-accent text-white border-dark-accent'
          : 'bg-dark-card text-dark-textSec border-dark-border hover:border-dark-border'
      }`}
    >
      {label} ({count})
    </button>
  );
}
