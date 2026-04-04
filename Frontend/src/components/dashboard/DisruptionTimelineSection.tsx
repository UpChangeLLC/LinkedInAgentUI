import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield, ChevronDown } from 'lucide-react';
import { Card } from '../ui/Card';
import type { DisruptionItem } from '../../data/mockResults';

interface DisruptionTimelineSectionProps {
  items: DisruptionItem[];
  roleName?: string;
}

const IMPACT_CONFIG = {
  high: { color: 'bg-dark-red', text: 'text-dark-red', bg: 'bg-dark-red/10', label: 'High Risk', dot: '#F87171' },
  medium: { color: 'bg-dark-amber', text: 'text-dark-amber', bg: 'bg-dark-amber/10', label: 'Medium', dot: '#FBBF24' },
  low: { color: 'bg-dark-green', text: 'text-dark-green', bg: 'bg-dark-green/10', label: 'Low Risk', dot: '#34D399' },
};

export function DisruptionTimelineSection({ items, roleName }: DisruptionTimelineSectionProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!items.length) return null;

  const currentYear = new Date().getFullYear();
  const highRiskCount = items.filter((i) => i.impact === 'high').length;
  const nearTermHighRisk = items.filter(
    (i) => i.impact === 'high' && i.year <= currentYear + 4
  ).length;

  // Force timeline to start at current year
  const years = [...new Set(items.map((i) => i.year))].sort();
  const minYear = Math.max(currentYear, Math.min(...years));

  // Group items by year, sorted
  const byYear = new Map<number, (DisruptionItem & { origIdx: number })[]>();
  items.forEach((item, origIdx) => {
    const yr = Math.max(item.year, minYear);
    if (!byYear.has(yr)) byYear.set(yr, []);
    byYear.get(yr)!.push({ ...item, origIdx });
  });
  const sortedYears = [...byYear.keys()].sort();

  return (
    <div className="space-y-4">
      {roleName && (
        <p className="text-sm text-dark-textMuted">
          How AI may affect key tasks in your role as {roleName}
        </p>
      )}

      {/* Summary banner */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-dark-amber/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-dark-amber" />
          </div>
          <p className="text-sm text-dark-textSec">
            <span className="font-semibold text-dark-textPri">
              {highRiskCount} of {items.length}
            </span>{' '}
            key tasks face high automation risk.
            {nearTermHighRisk > 0 && (
              <span className="text-dark-red font-medium">
                {' '}
                {nearTermHighRisk} within the next 4 years.
              </span>
            )}
          </p>
        </div>
      </Card>

      {/* Vertical Timeline */}
      <Card className="p-6 md:p-8">
        <div className="relative">
          {/* Center line */}
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-[2px] bg-dark-elevated" />

          <div className="space-y-8">
            {sortedYears.map((year) => {
              const yearItems = byYear.get(year) || [];

              return (
                <div key={year}>
                  {/* Year marker */}
                  <div className="flex items-center gap-3 mb-4 relative">
                    <div className="w-8 md:w-12 h-8 md:h-8 rounded-full bg-dark-accent flex items-center justify-center z-10 flex-shrink-0">
                      <span className="text-xs font-bold text-dark-bg">{year}</span>
                    </div>
                    <div className="h-[1px] flex-1 bg-dark-border" />
                  </div>

                  {/* Task cards for this year */}
                  <div className="ml-12 md:ml-16 space-y-3">
                    {yearItems.map((item, i) => {
                      const cfg = IMPACT_CONFIG[item.impact] || IMPACT_CONFIG.medium;
                      const isExpanded = expandedIdx === item.origIdx;

                      return (
                        <motion.div
                          key={item.origIdx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <button
                            onClick={() => setExpandedIdx(isExpanded ? null : item.origIdx)}
                            className="w-full text-left rounded-lg border border-dark-border bg-dark-card hover:bg-dark-elevated/50 p-4 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {/* Impact dot */}
                              <div
                                className="w-2 h-8 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cfg.dot }}
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-dark-textPri">
                                    {item.task}
                                  </span>
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                                  >
                                    {cfg.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1.5">
                                  {/* Automation probability bar */}
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-20 h-[3px] bg-dark-elevated rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${item.automationProbability}%`,
                                          backgroundColor: cfg.dot,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-dark-textMuted">
                                      {item.automationProbability}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <ChevronDown
                                className={`w-4 h-4 text-dark-textMuted flex-shrink-0 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>

                            {/* Expanded mitigation */}
                            <AnimatePresence>
                              {isExpanded && item.mitigation && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 pt-3 border-t border-dark-border flex items-start gap-2">
                                    <Shield className="w-4 h-4 text-dark-accent flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-medium text-dark-textSec">
                                        Mitigation Strategy
                                      </p>
                                      <p className="text-xs text-dark-textMuted mt-0.5">
                                        {item.mitigation}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
