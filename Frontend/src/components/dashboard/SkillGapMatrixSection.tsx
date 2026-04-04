import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Card } from '../ui/Card';
import type { SkillGapItem } from '../../data/mockResults';

interface SkillGapMatrixSectionProps {
  skills: SkillGapItem[];
}

const CATEGORY_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  'ai-core': { fill: '#3B82F6', stroke: '#2563EB', label: 'AI Core' },
  'ai-adjacent': { fill: '#8B5CF6', stroke: '#7C3AED', label: 'AI Adjacent' },
  foundational: { fill: '#6B7280', stroke: '#4B5563', label: 'Foundational' },
};

const QUADRANT_LABELS = [
  { x: 25, y: 15, label: 'Develop Urgently', color: '#DC2626', sub: 'Low proficiency, high demand' },
  { x: 75, y: 15, label: 'Maintain', color: '#16A34A', sub: 'Strong and in-demand' },
  { x: 25, y: 85, label: 'Nice to Have', color: '#9CA3AF', sub: 'Low priority' },
  { x: 75, y: 85, label: 'Leverage', color: '#F59E0B', sub: 'Strong, explore new uses' },
];

// Chart dimensions
const W = 400;
const H = 340;
const PAD = { top: 30, right: 20, bottom: 45, left: 50 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function toX(proficiency: number) {
  return PAD.left + ((proficiency - 0.5) / 5) * plotW;
}
function toY(demand: number) {
  return PAD.top + plotH - ((demand - 0.5) / 5) * plotH;
}

export function SkillGapMatrixSection({ skills }: SkillGapMatrixSectionProps) {
  const [selected, setSelected] = useState<SkillGapItem | null>(null);

  if (!skills.length) return null;

  const midX = PAD.left + plotW / 2;
  const midY = PAD.top + plotH / 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Your Skill Gap Matrix</h3>
        <div className="flex gap-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, cfg]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cfg.fill }}
              />
              <span className="text-xs text-gray-500">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="flex-1 min-w-0">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full max-w-[500px] mx-auto"
              style={{ overflow: 'visible' }}
            >
              {/* Quadrant backgrounds */}
              <rect
                x={PAD.left}
                y={PAD.top}
                width={plotW / 2}
                height={plotH / 2}
                fill="#FEE2E2"
                opacity={0.3}
              />
              <rect
                x={midX}
                y={PAD.top}
                width={plotW / 2}
                height={plotH / 2}
                fill="#DCFCE7"
                opacity={0.3}
              />
              <rect
                x={PAD.left}
                y={midY}
                width={plotW / 2}
                height={plotH / 2}
                fill="#F3F4F6"
                opacity={0.3}
              />
              <rect
                x={midX}
                y={midY}
                width={plotW / 2}
                height={plotH / 2}
                fill="#FEF3C7"
                opacity={0.3}
              />

              {/* Quadrant labels */}
              {QUADRANT_LABELS.map((q, i) => (
                <text
                  key={i}
                  x={PAD.left + (q.x / 100) * plotW}
                  y={PAD.top + (q.y / 100) * plotH}
                  textAnchor="middle"
                  className="text-[9px] font-semibold"
                  fill={q.color}
                  opacity={0.7}
                >
                  {q.label}
                </text>
              ))}

              {/* Grid lines */}
              <line x1={midX} y1={PAD.top} x2={midX} y2={PAD.top + plotH} stroke="#E5E7EB" strokeDasharray="4 4" />
              <line x1={PAD.left} y1={midY} x2={PAD.left + plotW} y2={midY} stroke="#E5E7EB" strokeDasharray="4 4" />

              {/* Axes */}
              <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="#9CA3AF" />
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="#9CA3AF" />

              {/* Axis labels */}
              <text
                x={PAD.left + plotW / 2}
                y={H - 5}
                textAnchor="middle"
                className="text-[11px]"
                fill="#6B7280"
              >
                Your Proficiency
              </text>
              <text
                x={12}
                y={PAD.top + plotH / 2}
                textAnchor="middle"
                className="text-[11px]"
                fill="#6B7280"
                transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
              >
                Market Demand
              </text>

              {/* Tick labels */}
              {[1, 2, 3, 4, 5].map((v) => (
                <g key={`tick-${v}`}>
                  <text
                    x={toX(v)}
                    y={PAD.top + plotH + 16}
                    textAnchor="middle"
                    className="text-[10px]"
                    fill="#9CA3AF"
                  >
                    {v}
                  </text>
                  <text
                    x={PAD.left - 10}
                    y={toY(v) + 3}
                    textAnchor="end"
                    className="text-[10px]"
                    fill="#9CA3AF"
                  >
                    {v}
                  </text>
                </g>
              ))}

              {/* Skill dots */}
              {skills.map((skill, i) => {
                const cfg = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.foundational;
                const isSelected = selected?.name === skill.name;
                return (
                  <g
                    key={i}
                    onClick={() => setSelected(isSelected ? null : skill)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={toX(skill.proficiency)}
                      cy={toY(skill.marketDemand)}
                      r={isSelected ? 8 : 6}
                      fill={cfg.fill}
                      stroke={isSelected ? '#1F2937' : cfg.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={0.85}
                    />
                    {/* Label for larger dots or selected */}
                    {(isSelected || skill.marketDemand >= 4) && (
                      <text
                        x={toX(skill.proficiency)}
                        y={toY(skill.marketDemand) - 10}
                        textAnchor="middle"
                        className="text-[9px] font-medium"
                        fill="#374151"
                      >
                        {skill.name.length > 15
                          ? skill.name.slice(0, 14) + '...'
                          : skill.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detail panel */}
          <div className="lg:w-72 flex-shrink-0">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">
                        {selected.name}
                      </h4>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block"
                        style={{
                          backgroundColor:
                            CATEGORY_COLORS[selected.category]?.fill + '20',
                          color: CATEGORY_COLORS[selected.category]?.fill,
                        }}
                      >
                        {CATEGORY_COLORS[selected.category]?.label || selected.category}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Proficiency</span>
                      <span className="font-semibold text-gray-900">
                        {selected.proficiency}/5
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Market Demand</span>
                      <span className="font-semibold text-gray-900">
                        {selected.marketDemand}/5
                      </span>
                    </div>
                  </div>

                  {selected.justification && (
                    <p className="text-xs text-gray-600 mt-3 border-t border-gray-200 pt-2">
                      {selected.justification}
                    </p>
                  )}
                  {selected.learningResource && (
                    <div className="mt-2 text-xs bg-blue-50 border border-blue-100 rounded p-2 text-blue-700">
                      <span className="font-medium">Next step:</span>{' '}
                      {selected.learningResource}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center"
                >
                  <p className="text-sm text-gray-500">
                    Click a skill dot to see details
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {skills.length} skills analyzed
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </div>
  );
}
