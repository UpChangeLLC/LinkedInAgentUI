import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { BarChart3, Users, TrendingUp, AlertTriangle } from 'lucide-react';

interface TeamInsightsData {
  team_name: string;
  avg_score: number;
  member_count: number;
  score_distribution: Record<string, number>;
  role_distribution: Record<string, number>;
  high_performers: string[];
  needs_attention: string[];
}

interface TeamInsightsProps {
  insights: TeamInsightsData;
}

function DistributionBar({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const width = maxCount > 0 ? Math.max(5, (count / maxCount) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-14 text-right text-dark-textMuted font-mono text-xs">{label}</span>
      <div className="flex-1 h-4 bg-dark-elevated rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6 }}
          className="h-full bg-dark-accent rounded"
        />
      </div>
      <span className="w-6 text-dark-textSec font-medium text-xs">{count}</span>
    </div>
  );
}

export function TeamInsights({ insights }: TeamInsightsProps) {
  const maxDistCount = Math.max(1, ...Object.values(insights.score_distribution));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview stats */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-dark-accent" />
          <h4 className="font-bold text-dark-textPri">Team Overview</h4>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-dark-elevated rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-dark-textPri">{insights.avg_score}</p>
            <p className="text-xs text-dark-textMuted">Avg Score</p>
          </div>
          <div className="bg-dark-elevated rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-dark-textPri">{insights.member_count}</p>
            <p className="text-xs text-dark-textMuted">Members</p>
          </div>
        </div>

        <h5 className="text-sm font-semibold text-dark-textSec mb-2">Score Distribution</h5>
        <div className="space-y-1.5">
          {Object.entries(insights.score_distribution).map(([label, count]) => (
            <DistributionBar key={label} label={label} count={count} maxCount={maxDistCount} />
          ))}
        </div>
      </Card>

      {/* Strengths and gaps */}
      <Card className="p-6">
        <div className="space-y-6">
          {insights.high_performers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-dark-green" />
                <h4 className="font-bold text-dark-textPri">High Performers</h4>
              </div>
              <div className="space-y-2">
                {insights.high_performers.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 text-sm bg-dark-green/10 text-dark-green rounded-lg px-3 py-2"
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.needs_attention.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="font-bold text-dark-textPri">Needs Attention</h4>
              </div>
              <div className="space-y-2">
                {insights.needs_attention.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 text-sm bg-dark-amber/10 text-dark-amber rounded-lg px-3 py-2"
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.high_performers.length === 0 && insights.needs_attention.length === 0 && (
            <div className="text-center text-dark-textMuted py-8">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">More members needed for insights</p>
            </div>
          )}

          {/* Role distribution */}
          {Object.keys(insights.role_distribution).length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-dark-textSec mb-2">Role Breakdown</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(insights.role_distribution).map(([role, count]) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 bg-dark-elevated text-dark-textSec text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {role} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
