import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Clock, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import type { CareerPathway } from '../../data/mockResults';

interface CareerPathwaysSectionProps {
  pathways: CareerPathway[];
  currentRole?: string;
}

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-dark-green bg-dark-green/10' },
  moderate: { label: 'Moderate', color: 'text-dark-amber bg-dark-amber/10' },
  challenging: { label: 'Challenging', color: 'text-dark-red bg-dark-red/10' },
};

export function CareerPathwaysSection({ pathways, currentRole }: CareerPathwaysSectionProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!pathways.length) return null;

  return (
    <div className="space-y-4">
      {currentRole && (
        <p className="text-sm text-dark-textMuted">
          Personalized paths from your current role as {currentRole}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pathways.map((path, idx) => {
          const diff = DIFFICULTY_CONFIG[path.difficulty] || DIFFICULTY_CONFIG.moderate;
          const isSelected = selectedIdx === idx;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="cursor-pointer"
              onClick={() => setSelectedIdx(isSelected ? null : idx)}
            >
              <Card
                allowOverflow
                className={`p-6 h-full flex flex-col relative transition-all duration-200 ${
                  path.recommended
                    ? 'border-dark-accent border-2 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                    : 'border-dark-border'
                } ${
                  isSelected ? 'ring-1 ring-dark-accent/30' : ''
                } hover:-translate-y-1 hover:border-dark-borderHov hover:bg-dark-elevated/30 hover:shadow-lg hover:shadow-dark-accent/5`}
              >
                {path.recommended && (
                  <div className="absolute -top-3 left-4">
                    <span className="inline-flex items-center gap-1 bg-dark-accent text-dark-bg text-xs font-bold px-3 py-1 rounded-full">
                      <Star className="w-3 h-3" />
                      Recommended
                    </span>
                  </div>
                )}

                <h4 className="text-base font-bold text-dark-textPri mt-2 mb-2">
                  {path.name}
                </h4>
                <p className="text-sm text-dark-textSec mb-4 line-clamp-2">
                  {path.description}
                </p>

                {/* Metrics */}
                <div className="space-y-3 border-t border-dark-border pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-dark-textMuted">
                      <Clock className="w-3.5 h-3.5" />
                      Timeline
                    </span>
                    <span className="font-semibold text-dark-textPri">
                      {path.timelineMonths > 0 ? `${path.timelineMonths} months` : 'Varies'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-dark-textMuted">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Salary Impact
                    </span>
                    <span className="font-semibold text-dark-green">
                      {path.salaryImpact || 'Varies'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-textMuted">Difficulty</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.color}`}>
                      {diff.label}
                    </span>
                  </div>
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-dark-border space-y-4">
                        {/* Full description */}
                        <p className="text-sm text-dark-textSec">{path.description}</p>

                        {/* Timeline bar */}
                        {path.timelineMonths > 0 && (
                          <div>
                            <p className="text-xs text-dark-textMuted mb-1.5">Timeline to transition</p>
                            <div className="h-1.5 bg-dark-elevated rounded-full overflow-hidden">
                              <div
                                className="h-full bg-dark-accent rounded-full"
                                style={{ width: `${Math.min((path.timelineMonths / 24) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Required skills */}
                        {path.requiredSkills.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-dark-textMuted uppercase tracking-wide mb-2">
                              Skills Needed
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {path.requiredSkills.map((skill, si) => (
                                <span
                                  key={si}
                                  className="text-xs px-2 py-0.5 bg-dark-accentDim text-dark-accent rounded-full border border-dark-accent/20"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CTA */}
                        <button className="w-full py-2.5 rounded-lg bg-dark-accent text-dark-bg text-sm font-semibold hover:bg-teal-400 transition-colors">
                          Explore This Path
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
