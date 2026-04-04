import { motion } from 'framer-motion';
import { ScoreGauge } from '../ui/ScoreGauge';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EvidencePanel } from '../ui/EvidencePanel';
import { SourceBadge } from '../ui/SourceBadge';
import { MockResults } from '../../data/mockResults';
import { AlertTriangle, Target, BarChart3, Calendar } from 'lucide-react';
import { DeltaBadge } from '../ui/DeltaBadge';

interface OverviewSectionProps {
  results: MockResults;
}

export function OverviewSection({ results }: OverviewSectionProps) {
  const {
    executiveBrief,
    companyAnalysis,
    competitorIntel,
    industryBenchmarks,
    scoreFactors,
    scoreNarrative,
    scoreDelta,
  } = results;

  // Derive company name from personalProfile if available
  const companyName = results.personalProfile?.company || 'Your Company';

  return (
    <div className="space-y-8">
      {/* Executive Brief */}
      <div className="flex flex-col md:flex-row items-stretch gap-8">
        <div className="flex-1 bg-white p-8 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-linkedin">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Executive Brief
            </h2>
            <SourceBadge source="ai_inferred" size="sm" />
          </div>
          <p className="text-gray-700 text-lg leading-relaxed">
            {executiveBrief}
          </p>
        </div>
        <div className="flex-shrink-0 w-full md:w-auto">
          <Card className="h-full p-6 flex flex-col items-center justify-center min-w-[280px]">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              Corporate Resilience Score
            </h3>
            <ScoreGauge score={results.score} riskBand={results.riskBand} />
            {/* F22: Score delta */}
            {scoreDelta && scoreDelta.scoreDelta !== 0 && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <DeltaBadge delta={scoreDelta.scoreDelta} label="points" size="md" />
                {scoreDelta.daysSinceLast > 0 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    since {scoreDelta.daysSinceLast} days ago
                  </span>
                )}
              </div>
            )}
            {/* Score Narrative (F18) */}
            {scoreNarrative && (
              <p className="text-xs text-gray-500 text-center mt-3 leading-relaxed max-w-[250px]">
                {scoreNarrative}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Company Analysis */}
      {companyAnalysis && (
        <Card className="p-8 bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-linkedin" />
            <h3 className="text-lg font-bold text-gray-900">
              Strategic Analysis
            </h3>
            <SourceBadge source="ai_inferred" size="sm" />
          </div>
          <p className="text-gray-700 leading-relaxed">{companyAnalysis}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Competitor Intelligence */}
        {competitorIntel.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Competitor Intelligence
              <SourceBadge source="market_data" size="sm" />
            </h3>
            {competitorIntel.map((comp, i) => (
              <Card key={i} className="p-5 border-l-4 border-l-amber-400">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-900">{comp.name}</h4>
                  <Badge variant="warning">Threat</Badge>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {comp.aiInitiative}
                </p>
                <p className="text-xs text-gray-500">Impact: {comp.impact}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Industry Benchmarks */}
        {industryBenchmarks.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-linkedin" />
              Industry Benchmarks
              <SourceBadge source="market_data" size="sm" />
            </h3>
            <Card className="p-6 h-full">
              <div className="space-y-6">
                {industryBenchmarks.map((bench, i) => {
                  const maxVal = Math.max(bench.industryAvg, bench.userValue);
                  const userWidth = maxVal > 0 ? (bench.userValue / maxVal) * 100 : 0;
                  const avgWidth = maxVal > 0 ? (bench.industryAvg / maxVal) * 100 : 0;
                  const isAhead = bench.userValue >= bench.industryAvg;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">{bench.metric}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                            {companyName}
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isAhead ? 'bg-green-500' : 'bg-red-400'}`}
                              style={{ width: `${userWidth}%` }}
                            />
                          </div>
                          <span
                            className={`font-bold text-sm w-12 text-right ${isAhead ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {bench.userValue}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                            Industry Avg
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-400 rounded-full"
                              style={{ width: `${avgWidth}%` }}
                            />
                          </div>
                          <span className="font-medium text-gray-500 text-sm w-12 text-right">
                            {bench.industryAvg}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5 italic">{bench.insight}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Detailed Score Factors with Evidence */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Detailed Risk Factors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scoreFactors.map((factor, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-gray-900 text-lg">{factor.name}</span>
                  <div className="flex items-center gap-2">
                    {factor.confidence && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          factor.confidence === 'high'
                            ? 'bg-green-50 text-green-600'
                            : factor.confidence === 'low'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-yellow-50 text-yellow-600'
                        }`}
                      >
                        {factor.confidence}
                      </span>
                    )}
                    <Badge variant={factor.weight === 'High' ? 'warning' : 'neutral'}>
                      {factor.weight} Impact
                    </Badge>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.value}%` }}
                        transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                        className="h-full bg-linkedin rounded-full"
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                      {factor.value}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-auto">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="font-semibold text-gray-900 block mb-1">
                      Analysis:
                    </span>
                    {factor.personalContext}
                  </p>
                  {/* Evidence panel (F11) */}
                  {(factor.evidence?.length || factor.narrative) && (
                    <EvidencePanel
                      evidence={factor.evidence || []}
                      confidence={factor.confidence}
                      narrative={factor.narrative}
                    />
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
