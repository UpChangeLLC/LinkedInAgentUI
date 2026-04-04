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
  high: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: 'High Risk' },
  medium: { color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Medium Risk' },
  low: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', label: 'Low Risk' },
};

export function DisruptionTimelineSection({ items, roleName }: DisruptionTimelineSectionProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!items.length) return null;

  const highRiskCount = items.filter((i) => i.impact === 'high').length;
  const currentYear = new Date().getFullYear();
  const nearTermHighRisk = items.filter(
    (i) => i.impact === 'high' && i.year <= currentYear + 4
  ).length;

  // Group by year for timeline layout
  const years = [...new Set(items.map((i) => i.year))].sort();
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearSpan = Math.max(maxYear - minYear, 1);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">AI Disruption Timeline</h3>
        {roleName && (
          <p className="text-sm text-gray-500 mt-1">
            How AI may affect key tasks in your role as {roleName}
          </p>
        )}
      </div>

      {/* Summary banner */}
      <Card className="p-4 bg-gray-50 border-gray-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">
              {highRiskCount} of {items.length}
            </span>{' '}
            key tasks face high automation risk.
            {nearTermHighRisk > 0 && (
              <span className="text-red-600 font-medium">
                {' '}
                {nearTermHighRisk} within the next 4 years.
              </span>
            )}
          </p>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="p-6">
        {/* Year axis */}
        <div className="relative mb-8">
          <div className="h-1 bg-gray-200 rounded-full" />
          <div className="flex justify-between mt-2">
            {years.map((year) => {
              const pct = ((year - minYear) / yearSpan) * 100;
              return (
                <div
                  key={year}
                  className="text-xs font-medium text-gray-500"
                  style={{
                    position: years.length <= 2 ? 'relative' : 'absolute',
                    left: years.length <= 2 ? undefined : `${pct}%`,
                    transform: years.length <= 2 ? undefined : 'translateX(-50%)',
                  }}
                >
                  {year}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task cards */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const cfg = IMPACT_CONFIG[item.impact] || IMPACT_CONFIG.medium;
            const isExpanded = expandedIdx === idx;
            const yearPct = ((item.year - minYear) / yearSpan) * 100;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className={`w-full text-left rounded-lg border p-4 transition-all ${cfg.border} ${
                    isExpanded ? cfg.bg : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Impact indicator */}
                    <div className={`w-2 h-8 rounded-full ${cfg.color} flex-shrink-0`} />

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {item.task}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">
                          Est. {item.year}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cfg.color}`}
                              style={{ width: `${item.automationProbability}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {item.automationProbability}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Year position indicator */}
                    <span className="text-sm font-bold text-gray-400 flex-shrink-0">
                      {item.year}
                    </span>

                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && item.mitigation && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-start gap-2">
                          <Shield className="w-4 h-4 text-linkedin flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-gray-700">
                              Mitigation Strategy
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
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
      </Card>
    </div>
  );
}
