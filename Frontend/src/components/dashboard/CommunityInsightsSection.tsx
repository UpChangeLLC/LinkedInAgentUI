import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, AlertTriangle, BarChart3, ShieldCheck } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

const BASE_URL = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

interface CommunityData {
  total_this_month: number;
  most_improved_dimension: { dimension: string; avg_improvement: number } | null;
  avg_score_by_role: Record<string, number>;
  top_skill_gaps: string[];
}

export function CommunityInsightsSection() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/community-insights`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Community Pulse</h2>
        <Card className="p-8">
          <div className="flex items-center justify-center text-gray-400">
            <Users className="w-5 h-5 mr-2 animate-pulse" />
            Loading community insights...
          </div>
        </Card>
      </div>
    );
  }

  const roles = data ? Object.entries(data.avg_score_by_role) : [];
  const maxRoleScore = roles.length > 0 ? Math.max(...roles.map(([, s]) => s)) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Community Pulse</h2>
        <p className="text-gray-600 mt-2">
          Anonymous, aggregated insights from the AI Resilience Score community.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Assessments this month */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-linkedin/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-linkedin" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data?.total_this_month ?? 0}
              </div>
              <div className="text-sm text-gray-500">Assessments this month</div>
            </div>
          </div>
        </Card>

        {/* Most improved dimension */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              {data?.most_improved_dimension ? (
                <>
                  <div className="text-sm font-bold text-gray-900">
                    {data.most_improved_dimension.dimension}
                  </div>
                  <div className="text-sm text-gray-500">
                    Most improved dimension (+{data.most_improved_dimension.avg_improvement} avg)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-gray-700">Not enough data yet</div>
                  <div className="text-sm text-gray-500">Most improved dimension</div>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Top skill gaps */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Top Skill Gaps</div>
              {data?.top_skill_gaps && data.top_skill_gaps.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.top_skill_gaps.slice(0, 3).map((gap) => (
                    <Badge key={gap} variant="warning">
                      {gap}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Not enough data yet</div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Score Distribution by Role */}
      {roles.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Score by Role</h3>
          <div className="space-y-3">
            {roles
              .sort(([, a], [, b]) => b - a)
              .map(([role, score], i) => (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-32 text-sm text-gray-600 truncate flex-shrink-0">{role}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(score / 100) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{
                        backgroundColor:
                          score >= 80
                            ? '#22c55e'
                            : score >= 60
                            ? '#0a66c2'
                            : score >= 40
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-bold text-gray-900">{score}</div>
                </motion.div>
              ))}
          </div>
        </Card>
      )}

      {/* All skill gaps */}
      {data?.top_skill_gaps && data.top_skill_gaps.length > 3 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Top Skill Gaps Across Community
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.top_skill_gaps.map((gap, i) => (
              <motion.div
                key={gap}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Badge variant={i === 0 ? 'danger' : i < 3 ? 'warning' : 'neutral'}>
                  {gap}
                </Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Opt-in notice */}
      <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
        <ShieldCheck className="w-4 h-4" />
        <span>
          Opt-in: your data contributes to these insights anonymously. No personal information is
          shared.
        </span>
      </div>
    </div>
  );
}
