import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Shield, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { MockResults, GovernanceItem } from '../../data/mockResults';

interface GovernanceSectionProps {
  results: MockResults;
}

/* ── Colour maps ──────────────────────────────────────── */

const STATUS_ORDER: GovernanceItem['currentStatus'][] = ['missing', 'partial', 'implemented'];
const RISK_ORDER: GovernanceItem['riskLevel'][] = ['critical', 'high', 'medium', 'low'];

const statusColors: Record<string, string> = {
  missing: 'bg-red-500',
  partial: 'bg-amber-400',
  implemented: 'bg-emerald-500',
};

const statusBgLight: Record<string, string> = {
  missing: 'bg-red-50 border-red-200',
  partial: 'bg-amber-50 border-amber-200',
  implemented: 'bg-emerald-50 border-emerald-200',
};

const riskColors: Record<string, string> = {
  critical: 'text-red-700 bg-red-100 border-red-200',
  high: 'text-orange-700 bg-orange-100 border-orange-200',
  medium: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  low: 'text-gray-700 bg-gray-100 border-gray-200',
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

/* ── Helpers ──────────────────────────────────────────── */

function maturityLabel(items: GovernanceItem[]): { label: string; color: string; icon: React.ReactNode } {
  const implemented = items.filter(i => i.currentStatus === 'implemented').length;
  const partial = items.filter(i => i.currentStatus === 'partial').length;
  const total = items.length;
  const score = implemented + partial * 0.5;
  const pct = total > 0 ? score / total : 0;

  if (pct >= 0.75) return { label: 'Strong', color: 'text-emerald-700', icon: <ShieldCheck className="w-6 h-6 text-emerald-600" /> };
  if (pct >= 0.5) return { label: 'Developing', color: 'text-amber-700', icon: <Shield className="w-6 h-6 text-amber-500" /> };
  if (pct >= 0.25) return { label: 'Emerging', color: 'text-orange-700', icon: <ShieldAlert className="w-6 h-6 text-orange-500" /> };
  return { label: 'Critical Risk', color: 'text-red-700', icon: <ShieldAlert className="w-6 h-6 text-red-600" /> };
}

function maturityPercentage(items: GovernanceItem[]): number {
  const implemented = items.filter(i => i.currentStatus === 'implemented').length;
  const partial = items.filter(i => i.currentStatus === 'partial').length;
  const total = items.length;
  if (total === 0) return 0;
  return Math.round(((implemented + partial * 0.5) / total) * 100);
}

/* ── Main component ───────────────────────────────────── */

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
      {/* ── Summary banner ───────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-gray-100 rounded-full">{maturity.icon}</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">
              Governance Maturity:{' '}
              <span className={maturity.color}>{maturity.label}</span>
            </h2>
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-900">{implementedCount} of {items.length}</span>{' '}
              controls implemented
              {partialCount > 0 && <>, <span className="font-semibold">{partialCount}</span> partial</>}
              {missingCount > 0 && <>, <span className="font-semibold text-red-600">{missingCount}</span> missing</>}
            </p>
          </div>
          {/* Maturity gauge */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : pct >= 25 ? 'bg-orange-400' : 'bg-red-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700">{pct}%</span>
          </div>
        </div>
      </div>

      {/* ── Heatmap grid ─────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-bold text-gray-900">Governance Heatmap</h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="invisible group-hover:visible absolute left-6 top-0 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
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
                          ? `${cellHeatColor[status][risk]} border-transparent cursor-pointer hover:ring-2 hover:ring-linkedin hover:ring-offset-1`
                          : 'bg-gray-50 border-dashed border-gray-200 cursor-default'
                      } ${selectedItem && cellItems.includes(selectedItem) ? 'ring-2 ring-linkedin ring-offset-2' : ''}`}
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
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Urgency:</span>
          {(['missing', 'partial', 'implemented'] as const).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-3 h-3 rounded ${statusColors[s]}`} />
              <span className="capitalize">{s}</span>
            </span>
          ))}
        </div>
      </Card>

      {/* ── Selected item detail panel ────────────────── */}
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

      {/* ── Full governance card list ─────────────────── */}
      <div className="grid grid-cols-1 gap-6">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card
              className={`p-6 cursor-pointer transition-all hover:shadow-md ${
                selectedItem === item ? 'ring-2 ring-linkedin' : ''
              }`}
              onClick={() => setSelectedItem(item === selectedItem ? null : item)}
            >
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Status Column */}
                <div className="md:w-1/4 flex flex-col gap-2">
                  <h3 className="font-bold text-gray-900 text-lg">{item.control}</h3>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={item.currentStatus} />
                    <span className="text-sm font-medium capitalize text-gray-600">
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
                    <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                      Why it matters
                    </span>
                    <p className="text-sm text-gray-700">{item.whyItMatters}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                      Industry Context
                    </span>
                    <p className="text-xs text-gray-600 italic">{item.industryContext}</p>
                  </div>
                </div>

                {/* Action Column */}
                <div className="md:w-1/4 w-full bg-linkedin/5 p-4 rounded-lg border border-linkedin/10">
                  <span className="text-xs font-bold text-linkedin uppercase block mb-2">
                    Policy Suggestion
                  </span>
                  <p className="text-sm text-gray-800 font-medium leading-snug">
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

/* ── Detail card (shown when heatmap cell is clicked) ── */

function GovernanceDetailCard({ item, onClose }: { item: GovernanceItem; onClose: () => void }) {
  return (
    <Card className="p-6 border-linkedin/30 bg-linkedin/5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIndicator status={item.currentStatus} />
          <h3 className="font-bold text-gray-900 text-lg">{item.control}</h3>
          <RiskBadge level={item.riskLevel} />
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Why it matters</span>
          <p className="text-sm text-gray-700">{item.whyItMatters}</p>
        </div>
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Industry Context</span>
          <p className="text-sm text-gray-600 italic">{item.industryContext}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-linkedin/20">
          <span className="text-xs font-bold text-linkedin uppercase block mb-1">Recommended Action</span>
          <p className="text-sm text-gray-800 font-medium">{item.policySuggestion}</p>
        </div>
      </div>
    </Card>
  );
}

/* ── Small sub-components ─────────────────────────────── */

function StatusIndicator({ status }: { status: string }) {
  if (status === 'implemented') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'partial') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider ${colors[level] || colors.low}`}>
      {level} Risk
    </span>
  );
}
