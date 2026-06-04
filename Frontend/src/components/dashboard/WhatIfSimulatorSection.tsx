import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Plus, Minus, ArrowUpRight, RotateCcw, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { ScoreGauge } from '../ui/ScoreGauge';
import { simulateScore, type SimulateScenario } from '../../lib/mcp';

interface WhatIfSimulatorSectionProps {
  currentScore: number;
  riskBand: string;
  currentRole?: string;
  /** Inputs for the real /api/simulate recompute. Without a linkedinUrl the
   * simulator falls back to indicative (estimated) deltas. */
  linkedinUrl?: string;
  surveyResponses?: Record<string, unknown> | null;
  userContext?: Record<string, unknown> | null;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  scoreDelta: number; // indicative fallback only
  category: 'certification' | 'experience' | 'education' | 'company';
  howTo: string;
  patch: SimulateScenario; // maps the scenario to real model inputs
}

const SCENARIOS: Scenario[] = [
  {
    id: 'ai-cert', title: 'Complete an AI Certification',
    description: 'Earn AWS ML Specialty, Google AI, or similar certification',
    scoreDelta: 8, category: 'certification',
    howTo: 'Start with Google AI Essentials on Coursera (40hrs), then pursue a cloud provider ML certification.',
    patch: { type: 'certification', value: 'AI/ML Certification' },
  },
  {
    id: 'ai-project', title: 'Lead an AI Project',
    description: 'Own and deliver an AI/ML implementation at your company',
    scoreDelta: 12, category: 'experience',
    howTo: 'Identify a workflow with manual data processing. Propose a pilot using an off-the-shelf AI API.',
    patch: { type: 'project', value: 'AI Project Lead' },
  },
  {
    id: 'python-ml', title: 'Learn Python & ML Fundamentals',
    description: 'Build hands-on coding skills in Python and machine learning',
    scoreDelta: 6, category: 'education',
    howTo: 'Take fast.ai Practical Deep Learning course (free). Practice on Kaggle with real datasets.',
    patch: { type: 'skill', value: ['Python', 'Machine Learning'] },
  },
  {
    id: 'ai-company', title: 'Move to an AI-Forward Company',
    description: 'Join a company with mature AI adoption and culture',
    scoreDelta: 10, category: 'company',
    howTo: 'Target companies listed in AI 50 or with dedicated AI/ML engineering teams.',
    patch: { type: 'company', value: 'Artificial Intelligence' },
  },
  {
    id: 'ai-governance', title: 'Establish AI Governance Framework',
    description: 'Define responsible AI policies and review processes',
    scoreDelta: 5, category: 'experience',
    howTo: 'Use NIST AI RMF as a template. Start with an AI use policy for your team.',
    patch: { type: 'project', value: 'AI Governance Lead' },
  },
  {
    id: 'ai-network', title: 'Build an AI Professional Network',
    description: 'Connect with AI leaders, join AI communities and events',
    scoreDelta: 4, category: 'experience',
    howTo: 'Attend 2 AI meetups/month. Engage with AI thought leaders on LinkedIn. Join a GenAI Slack community.',
    patch: { type: 'skill', value: 'AI Community Leadership' },
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  certification: '📜', experience: '💼', education: '📚', company: '🏢',
};

export function WhatIfSimulatorSection({
  currentScore, riskBand, linkedinUrl, surveyResponses, userContext,
}: WhatIfSimulatorSectionProps) {
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set());
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  // Real model recompute: simulated baseline (no scenarios) + current projection.
  const [baseSim, setBaseSim] = useState<number | null>(null);
  const [projSim, setProjSim] = useState<number | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    setActiveScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Fetch the simulated baseline once (so projections anchor to a model-computed delta).
  useEffect(() => {
    if (!linkedinUrl) { setApiOk(false); return; }
    let cancelled = false;
    simulateScore({ linkedin_url: linkedinUrl, survey_responses: surveyResponses, user_context: userContext, scenarios: [] })
      .then((r) => {
        if (cancelled) return;
        if (r.available && typeof r.resilience_score === 'number') { setBaseSim(r.resilience_score); setApiOk(true); }
        else setApiOk(false);
      })
      .catch(() => { if (!cancelled) setApiOk(false); });
    return () => { cancelled = true; };
  }, [linkedinUrl, surveyResponses, userContext]);

  // Recompute the projection (debounced) whenever the active scenarios change.
  useEffect(() => {
    if (apiOk !== true || !linkedinUrl) return;
    if (activeScenarios.size === 0) { setProjSim(baseSim); return; }
    const patches = [...activeScenarios]
      .map((id) => SCENARIOS.find((s) => s.id === id)?.patch)
      .filter((p): p is SimulateScenario => Boolean(p));
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      simulateScore({ linkedin_url: linkedinUrl, survey_responses: surveyResponses, user_context: userContext, scenarios: patches })
        .then((r) => { if (!cancelled && r.available && typeof r.resilience_score === 'number') setProjSim(r.resilience_score); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [activeScenarios, apiOk, linkedinUrl, surveyResponses, userContext, baseSim]);

  // Fallback indicative delta (sum of curated deltas) when the API is unavailable.
  const fallbackDelta = useMemo(() => {
    let d = 0;
    activeScenarios.forEach((id) => { const s = SCENARIOS.find((x) => x.id === id); if (s) d += s.scoreDelta; });
    return d;
  }, [activeScenarios]);

  const modelDelta = apiOk === true && baseSim != null && projSim != null ? Math.round(projSim - baseSim) : null;
  const delta = activeScenarios.size === 0 ? 0 : (modelDelta ?? fallbackDelta);
  const projectedScore = Math.max(0, Math.min(100, currentScore + delta));
  const totalDelta = projectedScore - currentScore;

  const projectedBand =
    activeScenarios.size === 0 ? riskBand :
    projectedScore >= 80 ? 'High Readiness' :
    projectedScore >= 60 ? 'Moderate Risk' :
    projectedScore >= 40 ? 'Elevated Risk' : 'High Risk';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-dark-textPri flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          What-If Simulator
        </h3>
        <p className="text-sm text-dark-textMuted mt-1">
          Toggle scenarios to see how your score could change
          {apiOk === false && <span className="ml-1 text-dark-textMuted">(estimated — live recompute unavailable)</span>}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Scenario cards */}
        <div className="flex-1 space-y-2">
          {SCENARIOS.map((scenario) => {
            const isActive = activeScenarios.has(scenario.id);
            const isExpanded = expandedScenario === scenario.id;
            return (
              <motion.div key={scenario.id} layout>
                <Card
                  className={`p-4 cursor-pointer transition-all ${
                    isActive ? 'border-dark-accent bg-blue-500/10' : 'border-dark-border hover:border-dark-border'
                  }`}
                >
                  <div className="flex items-center gap-3" onClick={() => toggle(scenario.id)}>
                    <button
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive ? 'bg-dark-accent text-white' : 'bg-dark-elevated text-dark-textMuted hover:bg-dark-elevated'
                      }`}
                    >
                      {isActive ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CATEGORY_ICONS[scenario.category]}</span>
                        <span className="text-sm font-semibold text-dark-textPri">{scenario.title}</span>
                      </div>
                      <p className="text-xs text-dark-textMuted mt-0.5">{scenario.description}</p>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${isActive ? 'text-dark-green' : 'text-dark-textMuted'}`}>
                      ~+{scenario.scoreDelta}
                    </span>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedScenario(isExpanded ? null : scenario.id); }}
                    className="mt-2 text-xs text-dark-accent hover:underline flex items-center gap-1"
                  >
                    How to achieve this
                    <ArrowUpRight className="w-3 h-3" />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-dark-textSec mt-2 pt-2 border-t border-dark-border">{scenario.howTo}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Projected score */}
        <div className="lg:w-72 flex-shrink-0">
          <Card className="p-6 sticky top-4">
            <div className="text-center">
              <p className="text-xs font-medium text-dark-textMuted uppercase tracking-wide mb-3 flex items-center justify-center gap-1">
                {activeScenarios.size > 0 ? 'Projected Score' : 'Current Score'}
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              </p>
              <ScoreGauge score={projectedScore} riskBand={projectedBand} />

              {totalDelta > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 inline-flex items-center gap-1 bg-dark-green/10 text-dark-green text-sm font-bold px-3 py-1 rounded-full"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  +{totalDelta} points
                </motion.div>
              )}

              {apiOk === true && activeScenarios.size > 0 && (
                <p className="text-[10px] text-dark-textMuted mt-2">Model-computed projection</p>
              )}

              {activeScenarios.size > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-dark-textMuted">
                    {activeScenarios.size} scenario{activeScenarios.size > 1 ? 's' : ''} selected
                  </p>
                  <button
                    onClick={() => setActiveScenarios(new Set())}
                    className="mt-2 text-xs text-dark-textMuted hover:text-dark-textSec flex items-center gap-1 mx-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset all
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
