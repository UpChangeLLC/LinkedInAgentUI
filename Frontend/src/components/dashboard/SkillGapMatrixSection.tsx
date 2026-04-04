import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import type { SkillGapItem } from '../../data/mockResults';

interface SkillGapMatrixSectionProps {
  skills: SkillGapItem[];
}

const CATEGORY_CONFIG: Record<string, { color: string; label: string }> = {
  'ai-core': { color: '#14B8A6', label: 'AI Core' },
  'ai-adjacent': { color: '#A78BFA', label: 'AI Adjacent' },
  foundational: { color: '#64748B', label: 'Foundational' },
};

export function SkillGapMatrixSection({ skills }: SkillGapMatrixSectionProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!skills.length) return null;

  // Sort by gap descending (biggest gaps first)
  const sorted = [...skills].sort((a, b) => {
    const gapA = a.marketDemand - a.proficiency;
    const gapB = b.marketDemand - b.proficiency;
    return gapB - gapA;
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            <span className="text-xs text-dark-textMuted">{cfg.label}</span>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_140px_140px_80px] gap-2 px-5 py-3 border-b border-dark-border text-[11px] font-semibold text-dark-textMuted uppercase tracking-wider">
          <span>#</span>
          <span>Skill</span>
          <span>Your Level</span>
          <span>Market Need</span>
          <span className="text-right">Gap</span>
        </div>

        {/* Table rows */}
        {sorted.map((skill, idx) => {
          const cat = CATEGORY_CONFIG[skill.category] || CATEGORY_CONFIG.foundational;
          const gap = skill.marketDemand - skill.proficiency;
          const profPct = (skill.proficiency / 5) * 100;
          const demandPct = (skill.marketDemand / 5) * 100;
          const isExpanded = expandedIdx === idx;

          return (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full text-left grid grid-cols-[40px_1fr_140px_140px_80px] gap-2 items-center px-5 py-3.5 border-b border-dark-border hover:bg-dark-elevated/50 transition-colors"
              >
                {/* Row number */}
                <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold bg-dark-accentDim text-dark-accent">
                  {idx + 1}
                </span>

                {/* Skill name with category dot */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm font-medium text-dark-textPri truncate">
                    {skill.name}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-dark-textMuted flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Your Level - thin progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[3px] bg-dark-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-dark-accent"
                      style={{ width: `${profPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-dark-textSec w-6 text-right">
                    {skill.proficiency}
                  </span>
                </div>

                {/* Market Need - thin muted bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[3px] bg-dark-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-dark-textMuted"
                      style={{ width: `${demandPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-dark-textSec w-6 text-right">
                    {skill.marketDemand}
                  </span>
                </div>

                {/* Gap */}
                <span
                  className={`text-sm font-bold text-right ${
                    gap > 0
                      ? 'text-dark-accent'
                      : gap < 0
                      ? 'text-dark-green'
                      : 'text-dark-textMuted'
                  }`}
                >
                  {gap > 0 ? `+${gap}` : gap === 0 ? '0' : gap}
                </span>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 py-4 bg-dark-elevated/40 border-b border-dark-border">
                      <div className="pl-10 space-y-2">
                        {skill.justification && (
                          <p className="text-sm text-dark-textSec">
                            {skill.justification}
                          </p>
                        )}
                        {skill.learningResource && (
                          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-dark-accent hover:underline">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {skill.learningResource}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </Card>
    </div>
  );
}
