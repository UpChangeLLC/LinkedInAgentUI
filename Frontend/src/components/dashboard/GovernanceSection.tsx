import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Shield, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { MockResults, GovernanceItem } from '../../data/mockResults';

interface GovernanceSectionProps {
  results: MockResults;
}

/* -- Colour maps ------------------------------------------------ */

const STATUS_ORDER: GovernanceItem['currentStatus'][] = ['missing', 'partial', 'implemented'];
const RISK_ORDER: GovernanceItem['riskLevel'][] = ['critical', 'high', 'medium', 'low'];

const statusColors: Record<string, string> = {
  missing: 'bg-red-500',
  partial: 'bg-amber-400',
  implemented: 'bg-emerald-500',
};

const statusBgLight: Record<string, string> = {
  missing: 'bg-dark-red/10 border-dark-red/20',
  partial: 'bg-dark-amber/10 border-dark-amber/20',
  implemented: 'bg-emerald-500/10 border-emerald-500/20',
};

const riskColors: Record<string, string> = {
  critical: 'text-dark-red bg-dark-red/10 border-dark-red/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-dark-amber bg-dark-amber/10 border-dark-amber/20',
  low: 'text-dark-textSec bg-dark-elevated border-dark-border',
};

const cellHeatColor: Record<string, Record<string, string>> = {
  missing: {
    critical: 'bg-red-600 text-white',
    high: 'bg-red-500 text-white',
    medium: 'bg-red-300 text-red-900',
    low: 'bg-red-200 text-red-800',
  },
  partial: {
    critical: 'bg-amber-500 text-white',
    high: 'bg-amber-400 text-amber-900',
    medium: 'bg-amber-300 text-amber-900',
    low: 'bg-amber-200 text-amber-800',
  },
  implemented: {
    critical: 'bg-emerald-500 text-white',
    high: 'bg-emerald-400 text-emerald-900',
    medium: 'bg-emerald-300 text-emerald-900',
    low: 'bg-emerald-200 text-emerald-800',
  },
};

/* -- Helpers ---------------------------------------------------- */

function maturityLabel(items: GovernanceItem[]): { label: string; color: string; icon: React.ReactNode } {
  const implemented = items.filter(i => i.currentStatus === 'implemented').length;
  const partial = items.filter(i => i.currentStatus === 'partial').length;
  const total = items.length;
  const score = implemented + partial * 0.5;
  const pct = total > 0 ? score / total : 0;

  if (pct >= 0.75) return { label: 'Strong', color: 'text-emerald-400', icon: <ShieldCheck className="w-6 h-6 text-emerald-400" /> };
  if (pct >= 0.5) return { label: 'Developing', color: 'text-dark-amber', icon: <Shield className="w-6 h-6 text-amber-500" /> };
  if (pct >= 0.25) return { label: 'Emerging', color: 'text-orange-400', icon: <ShieldAlert className="w-6 h-6 text-orange-500" /> };
  return { label: 'Critical Risk', color: 'text-dark-red', icon: <ShieldAlert className="w-6 h-6 text-red-600" /> };
}

function maturityPercentage(items: GovernanceItem[]): number {
  const implemented = items.filter(i => i.currentStatus === 'implemented').length;
  const partial = items.filter(i => i.currentStatus === 'partial').length;
  const total = items.length;
  if (total === 0) return 0;
  return Math.round(((implemented + partial * 0.5) / total) * 100);
}

/* -- Main component --------------------------------------------- */

export function GovernanceSection({ results }: GovernanceSectionProps) {
  const [selectedItem, setSelectedItem] = useState<GovernanceItem | null>(null);
  const items = results.governanceItems;
  const maturity = maturityLabel(items);
  const pct = maturityPercentage(items);
  const implementedCount = items.filter(i => i.currentStatus === 'implemented').length;
  const partialCount = items.filter(i => i.currentStatus === 'partial').length;
  const missingCount = items.filter(i => i.currentStatus === 'missing').length;

  // Build heatmap grid: which items land in each cell
  const grid: Record<string, Record<string, GovernanceItem[]>> = {};
  for (const s of STATUS_ORDER) {
    grid[s] = {};
    for (const r of RISK_ORDER) grid[s][r] = [];
  }
  for (const item of items) {
    grid[item.currentStatus]?.[item.riskLevel]?.push(item);
  }

  return (
    <div className="space-y-8">
      {/* -- Summary banner ----------------------------------------- */}
      <div className="bg-dark-card p-6 rounded-xl border border-dark-border">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-dark-elevated rounded-full">{maturity.icon}</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-dark-textPri">
              Governance Maturity:{' '}
              <span className={maturity.color}>{maturity.label}</span>
            </h2>
            <p className="text-dark-textSec text-sm">
              <span className="font-semibold text-dark-textPri">{implementedCount} of {items.length}</span>{' '}
              controls implemented
              {partialCount > 0 && <>, <span className="font-semibold">{partialCount}</span> partial</>}
              {missingCount > 0 && <>, <span className="font-semibold text-dark-red">{missingCount}</span> missing</>}
            </p>
          </div>
          {/* Maturity gauge */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-3 bg-dark-elevated rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-sm font-bold text-dark-textSec">{pct}%</span>
          </div>
        </div>
      </div>

      {/* -- Heatmap grid ------------------------------------------- */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-bold text-dark-textPri">Governance Heatmap</h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-dark-textMuted cursor-help" />
            <div className="invisible group-hover:visible absolute left-6 top-0 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg">
              Each cell shows governance controls mapped by implementation status and risk level. Click a cell to see details.
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* Column headers */}
            <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 mb-2">
              <div /> {/* Corner */}
              {STATUS_ORDER.map(s => (
                <div key={s} className="text-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${statusBgLight[s]} border`}>
                    <span className={`w-2 h-2 rounded-full ${statusColors[s]}`} />
                    {s}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {RISK_ORDER.map(risk => (
              <div key={risk} className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 mb-2">
                {/* Row label */}
                <div className="flex items-center justify-end pr-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider ${riskColors[risk]}`}>
                    {risk}
                  </span>
                </div>
                {/* Cells */}
                {STATUS_ORDER.map(status => {
                  const cellItems = grid[status][risk];
                  const hasItems = cellItems.length > 0;
                  return (
                    <motion.button
                      key={`${status}-${risk}`}
                      className={`relative rounded-lg border-2 transition-all min-h-[64px] flex items-center justify-center ${
                        hasItems
                          ? `${cellHeatColor[status][risk]} border-transparent cursor-pointer hover:ring-2 hover:ring-dark-accent hover:ring-offset-1`
                          : 'bg-dark-elevated border-dashed border-dark-border cursor-default'
                      } ${selectedItem && cellItems.includes(selectedItem) ? 'ring-2 ring-dark-accent ring-offset-2' : ''}`}
                      onClick={() => hasItems && setSelectedItem(cellItems[0] === selectedItem ? null : cellItems[0])}
                      whileHover={hasItems ? { scale: 1.02 } : {}}
                      whileTap={hasItems ? { scale: 0.98 } : {}}
                    >
                      {hasItems ? (
                        <div className="text-center p-2">
                          <p className="text-xs font-bold leading-tight">{cellItems.length} control{cellItems.length > 1 ? 's' : ''}</p>
                          <p className="text-[10px] opacity-80 mt-0.5 leading-tight truncate max-w-[120px]">
                            {cellItems.map(i => i.control).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">--</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-dark-border">
          <span className="text-xs text-dark-textMuted font-medium">Urgency:</span>
          {(['missing', 'partial', 'implemented'] as const).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-dark-textSec">
              <span className={`w-3 h-3 rounded ${statusColors[s]}`} />
              <span className="capitalize">{s}</span>
            </span>
          ))}
        </div>
      </Card>

      {/* -- Selected item detail panel ------------------------------ */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <GovernanceDetailCard item={selectedItem} onClose={() => setSelectedItem(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Full governance card list -------------------------------- */}
      <div className="grid grid-cols-1 gap-6">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card
              className={`p-6 cursor-pointer transition-all ${
                selectedItem === item ? 'ring-2 ring-dark-accent' : ''
              }`}
              onClick={() => setSelectedItem(item === selectedItem ? null : item)}
            >
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Status Column */}
                <div className="md:w-1/4 flex flex-col gap-2">
                  <h3 className="font-bold text-dark-textPri text-lg">{item.control}</h3>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={item.currentStatus} />
                    <span className="text-sm font-medium capitalize text-dark-textSec">
                      {item.currentStatus}
                    </span>
                  </div>
                  <div className="mt-2">
                    <RiskBadge level={item.riskLevel} />
                  </div>
                </div>

                {/* Details Column */}
                <div className="md:w-1/2 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-dark-textMuted uppercase block mb-1">
                      Why it matters
                    </span>
                    <p className="text-sm text-dark-textSec">{item.whyItMatters}</p>
                  </div>
                  <div className="bg-dark-elevated p-3 rounded border border-dark-border">
                    <span className="text-xs font-bold text-dark-textMuted uppercase block mb-1">
                      Industry Context
                    </span>
                    <p className="text-xs text-dark-textSec italic">{item.industryContext}</p>
                  </div>
                </div>

                {/* Action Column */}
                <div className="md:w-1/4 w-full bg-dark-accentDim p-4 rounded-lg border border-dark-accent/10">
                  <span className="text-xs font-bold text-dark-accent uppercase block mb-2">
                    Policy Suggestion
                  </span>
                  <p className="text-sm text-dark-textPri font-medium leading-snug">
                    {item.policySuggestion}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* -- Detail card (shown when heatmap cell is clicked) ------------ */

function GovernanceDetailCard({ item, onClose }: { item: GovernanceItem; onClose: () => void }) {
  return (
    <Card className="p-6 border-dark-accent/30 bg-dark-accentDim">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIndicator status={item.currentStatus} />
          <h3 className="font-bold text-dark-textPri text-lg">{item.control}</h3>
          <RiskBadge level={item.riskLevel} />
        </div>
        <button
          onClick={onClose}
          className="text-dark-textMuted hover:text-dark-textSec text-sm font-medium px-2 py-1 rounded hover:bg-dark-elevated transition-colors"
        >
          Close
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-bold text-dark-textMuted uppercase block mb-1">Why it matters</span>
          <p className="text-sm text-dark-textSec">{item.whyItMatters}</p>
        </div>
        <div>
          <span className="text-xs font-bold text-dark-textMuted uppercase block mb-1">Industry Context</span>
          <p className="text-sm text-dark-textSec italic">{item.industryContext}</p>
        </div>
        <div className="bg-dark-card p-3 rounded-lg border border-dark-accent/20">
          <span className="text-xs font-bold text-dark-accent uppercase block mb-1">Recommended Action</span>
          <p className="text-sm text-dark-textPri font-medium">{item.policySuggestion}</p>
        </div>
      </div>
    </Card>
  );
}

/* -- Small sub-components ---------------------------------------- */

function StatusIndicator({ status }: { status: string }) {
  if (status === 'implemented') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'partial') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-dark-red/10 text-dark-red border-dark-red/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-dark-amber/10 text-dark-amber border-dark-amber/20',
    low: 'bg-dark-elevated text-dark-textSec border-dark-border',
  };
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider ${colors[level] || colors.low}`}>
      {level} Risk
    </span>
  );
}
