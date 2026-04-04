import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Plus, Minus, ArrowUpRight, RotateCcw } from 'lucide-react';
import { Card } from '../ui/Card';
import { ScoreGauge } from '../ui/ScoreGauge';

interface WhatIfSimulatorSectionProps {
  currentScore: number;
  riskBand: string;
  currentRole?: string;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  scoreDelta: number;
  category: 'certification' | 'experience' | 'education' | 'company';
  howTo: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'ai-cert',
    title: 'Complete an AI Certification',
    description: 'Earn AWS ML Specialty, Google AI, or similar certification',
    scoreDelta: 8,
    category: 'certification',
    howTo: 'Start with Google AI Essentials on Coursera (40hrs), then pursue a cloud provider ML certification.',
  },
  {
    id: 'ai-project',
    title: 'Lead an AI Project',
    description: 'Own and deliver an AI/ML implementation at your company',
    scoreDelta: 12,
    category: 'experience',
    howTo: 'Identify a workflow with manual data processing. Propose a pilot using an off-the-shelf AI API.',
  },
  {
    id: 'python-ml',
    title: 'Learn Python & ML Fundamentals',
    description: 'Build hands-on coding skills in Python and machine learning',
    scoreDelta: 6,
    category: 'education',
    howTo: 'Take fast.ai Practical Deep Learning course (free). Practice on Kaggle with real datasets.',
  },
  {
    id: 'ai-company',
    title: 'Move to an AI-Forward Company',
    description: 'Join a company with mature AI adoption and culture',
    scoreDelta: 10,
    category: 'company',
    howTo: 'Target companies listed in AI 50 or with dedicated AI/ML engineering teams.',
  },
  {
    id: 'ai-governance',
    title: 'Establish AI Governance Framework',
    description: 'Define responsible AI policies and review processes',
    scoreDelta: 5,
    category: 'experience',
    howTo: 'Use NIST AI RMF as a template. Start with an AI use policy for your team.',
  },
  {
    id: 'ai-network',
    title: 'Build an AI Professional Network',
    description: 'Connect with AI leaders, join AI communities and events',
    scoreDelta: 4,
    category: 'experience',
    howTo: 'Attend 2 AI meetups/month. Engage with AI thought leaders on LinkedIn. Join a GenAI Slack community.',
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  certification: '📜',
  experience: '💼',
  education: '📚',
  company: '🏢',
};

export function WhatIfSimulatorSection({
  currentScore,
  riskBand,
  currentRole,
}: WhatIfSimulatorSectionProps) {
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set());
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const toggle = (id: string) => {
    setActiveScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const projectedScore = useMemo(() => {
    let delta = 0;
    activeScenarios.forEach((id) => {
      const scenario = SCENARIOS.find((s) => s.id === id);
      if (scenario) delta += scenario.scoreDelta;
    });
    return Math.min(100, currentScore + delta);
  }, [currentScore, activeScenarios]);

  const totalDelta = projectedScore - currentScore;

  const projectedBand =
    projectedScore >= 80 ? 'High Readiness' :
    projectedScore >= 60 ? 'Moderate Risk' :
    projectedScore >= 40 ? 'Elevated Risk' : 'High Risk';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          What-If Simulator
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Toggle scenarios to see how your score could change
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
                    isActive
                      ? 'border-linkedin bg-blue-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3" onClick={() => toggle(scenario.id)}>
                    <button
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive
                          ? 'bg-linkedin text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {isActive ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CATEGORY_ICONS[scenario.category]}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {scenario.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {scenario.description}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold flex-shrink-0 ${
                        isActive ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      +{scenario.scoreDelta}
                    </span>
                  </div>

                  {/* How to achieve */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedScenario(isExpanded ? null : scenario.id);
                    }}
                    className="mt-2 text-xs text-linkedin hover:underline flex items-center gap-1"
                  >
                    How to achieve this
                    <ArrowUpRight className="w-3 h-3" />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                          {scenario.howTo}
                        </p>
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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                {activeScenarios.size > 0 ? 'Projected Score' : 'Current Score'}
              </p>
              <ScoreGauge score={projectedScore} riskBand={projectedBand} />

              {totalDelta > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 inline-flex items-center gap-1 bg-green-50 text-green-700 text-sm font-bold px-3 py-1 rounded-full"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  +{totalDelta} points
                </motion.div>
              )}

              {activeScenarios.size > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500">
                    {activeScenarios.size} scenario{activeScenarios.size > 1 ? 's' : ''} selected
                  </p>
                  <button
                    onClick={() => setActiveScenarios(new Set())}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
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
