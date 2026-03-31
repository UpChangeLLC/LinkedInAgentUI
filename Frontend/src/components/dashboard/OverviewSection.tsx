import React from 'react';
import { motion } from 'framer-motion';
import { ScoreGauge } from '../ui/ScoreGauge';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MockResults } from '../../data/mockResults';
import { TrendingUp, AlertTriangle, Target, BarChart3 } from 'lucide-react';
interface OverviewSectionProps {
  results: MockResults;
}
export function OverviewSection({ results }: OverviewSectionProps) {
  const {
    executiveBrief,
    companyAnalysis,
    competitorIntel,
    industryBenchmarks,
    scoreFactors
  } = results;
  return (
    <div className="space-y-8">
      {/* Executive Brief */}
      <div className="flex flex-col md:flex-row items-stretch gap-8">
        <div className="flex-1 bg-white p-8 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-linkedin">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Executive Brief for TechCorp
          </h2>
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
          </Card>
        </div>
      </div>

      {/* Company Analysis */}
      <Card className="p-8 bg-gray-50 border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-linkedin" />
          <h3 className="text-lg font-bold text-gray-900">
            Strategic Analysis
          </h3>
        </div>
        <p className="text-gray-700 leading-relaxed">{companyAnalysis}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Competitor Intelligence */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Competitor Intelligence
          </h3>
          {competitorIntel.map((comp, i) =>
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
          )}
        </div>

        {/* Industry Benchmarks */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-linkedin" />
            Industry Benchmarks
          </h3>
          <Card className="p-6 h-full">
            <div className="space-y-6">
              {industryBenchmarks.map((bench, i) => {
                const maxVal = Math.max(bench.industryAvg, bench.userValue);
                const userWidth =
                maxVal > 0 ? bench.userValue / maxVal * 100 : 0;
                const avgWidth =
                maxVal > 0 ? bench.industryAvg / maxVal * 100 : 0;
                const isAhead = bench.userValue >= bench.industryAvg;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700">
                        {bench.metric}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">
                          TechCorp
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isAhead ? 'bg-green-500' : 'bg-red-400'}`}
                            style={{
                              width: `${userWidth}%`
                            }} />
                          
                        </div>
                        <span
                          className={`font-bold text-sm w-12 text-right ${isAhead ? 'text-green-600' : 'text-red-600'}`}>
                          
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
                            style={{
                              width: `${avgWidth}%`
                            }} />
                          
                        </div>
                        <span className="font-medium text-gray-500 text-sm w-12 text-right">
                          {bench.industryAvg}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 italic">
                      {bench.insight}
                    </p>
                  </div>);

              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Detailed Score Factors */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Detailed Risk Factors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scoreFactors.map((factor, index) =>
          <motion.div
            key={index}
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: index * 0.1
            }}>
            
              <Card className="p-6 h-full flex flex-col hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-gray-900 text-lg">
                    {factor.name}
                  </span>
                  <Badge
                  variant={factor.weight === 'High' ? 'warning' : 'neutral'}>
                  
                    {factor.weight} Impact
                  </Badge>
                </div>
                <div className="mb-4">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                    initial={{
                      width: 0
                    }}
                    animate={{
                      width: `${factor.value}%`
                    }}
                    transition={{
                      duration: 1,
                      delay: 0.5 + index * 0.1
                    }}
                    className="h-full bg-linkedin rounded-full" />
                  
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3 mt-auto">
                  <span className="font-semibold text-gray-900 block mb-1">
                    Analysis:
                  </span>
                  {factor.personalContext}
                </p>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>);

}