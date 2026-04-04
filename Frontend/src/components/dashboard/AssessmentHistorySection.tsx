import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

const BASE_URL = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

interface Assessment {
  score: number;
  risk_band: string;
  dimension_scores: Record<string, any> | null;
  created_at: string;
}

interface Trajectory {
  slope_per_day: number;
  projected_low_risk_date: string | null;
  current_trend: 'improving' | 'declining' | 'already_low_risk';
}

interface Props {
  urlHash: string;
}

export function AssessmentHistorySection({ urlHash }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!urlHash) {
      setLoading(false);
      return;
    }
    fetch(`${BASE_URL}/api/history/${urlHash}`)
      .then((r) => r.json())
      .then((data) => {
        setAssessments(data.assessments || []);
        setTrajectory(data.trajectory || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [urlHash]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-dark-textPri">Assessment History</h2>
        <Card className="p-8">
          <div className="flex items-center justify-center text-dark-textMuted">
            <Clock className="w-5 h-5 mr-2 animate-spin" />
            Loading history...
          </div>
        </Card>
      </div>
    );
  }

  // Chronological order for chart (oldest first)
  const chronological = [...assessments].reverse();

  const riskBandVariant = (band: string) => {
    if (band?.toLowerCase().includes('low')) return 'success';
    if (band?.toLowerCase().includes('high') || band?.toLowerCase().includes('critical'))
      return 'danger';
    return 'warning';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // SVG chart dimensions
  const chartW = 600;
  const chartH = 200;
  const padX = 40;
  const padY = 30;

  const renderChart = () => {
    if (chronological.length < 2) return null;

    const scores = chronological.map((a) => a.score);
    const minScore = Math.max(0, Math.min(...scores) - 10);
    const maxScore = Math.min(100, Math.max(...scores) + 10);

    const xStep = (chartW - padX * 2) / (chronological.length - 1);
    const yScale = (s: number) =>
      chartH - padY - ((s - minScore) / (maxScore - minScore)) * (chartH - padY * 2);

    const points = chronological.map((a, i) => ({
      x: padX + i * xStep,
      y: yScale(a.score),
      score: a.score,
      date: a.created_at,
      riskBand: a.risk_band,
      dimensions: a.dimension_scores,
    }));

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full max-w-[600px] mx-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[minScore, Math.round((minScore + maxScore) / 2), maxScore].map((s) => (
            <g key={s}>
              <line
                x1={padX}
                y1={yScale(s)}
                x2={chartW - padX}
                y2={yScale(s)}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
              <text x={padX - 5} y={yScale(s) + 4} textAnchor="end" className="text-[10px] fill-gray-400">
                {s}
              </text>
            </g>
          ))}

          {/* 80-score target line */}
          {maxScore >= 80 && minScore <= 80 && (
            <g>
              <line
                x1={padX}
                y1={yScale(80)}
                x2={chartW - padX}
                y2={yScale(80)}
                stroke="#22c55e"
                strokeDasharray="6 3"
                opacity={0.5}
              />
              <text
                x={chartW - padX + 5}
                y={yScale(80) + 4}
                className="text-[9px] fill-green-500 font-medium"
              >
                Low Risk
              </text>
            </g>
          )}

          {/* Trend line */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#0a66c2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 7 : 5}
                fill={hoveredIndex === i ? '#0a66c2' : '#fff'}
                stroke="#0a66c2"
                strokeWidth="2.5"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* Date label */}
              <text
                x={p.x}
                y={chartH - 5}
                textAnchor="middle"
                className="text-[9px] fill-gray-400"
              >
                {new Date(p.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 bg-dark-card border border-dark-border rounded-lg shadow-lg p-3 z-10 min-w-[200px]"
          >
            <div className="text-sm font-bold text-dark-textPri">
              Score: {points[hoveredIndex].score}
            </div>
            <div className="text-xs text-dark-textMuted mt-0.5">
              {formatDate(points[hoveredIndex].date)}
            </div>
            <Badge variant={riskBandVariant(points[hoveredIndex].riskBand)} className="mt-1">
              {points[hoveredIndex].riskBand}
            </Badge>
            {points[hoveredIndex].dimensions && (
              <div className="mt-2 space-y-1">
                {Object.entries(points[hoveredIndex].dimensions!).slice(0, 4).map(([dim, data]) => (
                  <div key={dim} className="flex justify-between text-xs">
                    <span className="text-dark-textMuted truncate max-w-[120px]">{dim}</span>
                    <span className="font-medium text-dark-textSec">
                      {typeof data === 'object' ? (data as any).score ?? '-' : data}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark-textPri">Assessment History</h2>
        <p className="text-dark-textSec mt-2">
          Track your AI Resilience Score over time and see how you are progressing.
        </p>
      </div>

      {assessments.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-10 h-10 text-dark-elevated mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-dark-textSec">No Assessment History Yet</h3>
          <p className="text-dark-textMuted mt-2">
            Complete your first assessment to start tracking your progress.
          </p>
        </Card>
      ) : assessments.length === 1 ? (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-dark-accentDim rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-dark-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-textPri">This Is Your First Assessment</h3>
              <p className="text-dark-textSec mt-1">
                Your score: <span className="font-bold text-dark-accent">{assessments[0].score}</span>{' '}
                <Badge variant={riskBandVariant(assessments[0].risk_band)} className="ml-1">
                  {assessments[0].risk_band}
                </Badge>
              </p>
              <p className="text-dark-textMuted mt-3 text-sm">
                Come back in 30 days to track your progress. We will calculate your improvement
                trajectory and project when you will reach Low Risk status.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Score Trend Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-dark-textPri mb-4">Score Trend</h3>
            {renderChart()}
          </Card>

          {/* Trajectory Projection */}
          {trajectory && (
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      trajectory.current_trend === 'improving'
                        ? '#dcfce7'
                        : trajectory.current_trend === 'declining'
                        ? '#fee2e2'
                        : '#f0f9ff',
                  }}
                >
                  {trajectory.current_trend === 'improving' ? (
                    <TrendingUp className="w-5 h-5 text-dark-green" />
                  ) : trajectory.current_trend === 'declining' ? (
                    <TrendingDown className="w-5 h-5 text-dark-red" />
                  ) : (
                    <Minus className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-dark-textPri">Trajectory Projection</h3>
                  {trajectory.current_trend === 'improving' && trajectory.projected_low_risk_date ? (
                    <p className="text-dark-textSec mt-1">
                      At this rate, you will reach{' '}
                      <span className="font-semibold text-dark-green">Low Risk</span> by{' '}
                      <span className="font-bold">{trajectory.projected_low_risk_date}</span>.
                    </p>
                  ) : trajectory.current_trend === 'already_low_risk' ? (
                    <p className="text-dark-textSec mt-1">
                      You are already in the <span className="font-semibold text-dark-green">Low Risk</span> zone.
                      Keep it up!
                    </p>
                  ) : (
                    <p className="text-dark-textSec mt-1">
                      Your score trend is declining. Review your action items to get back on track.
                    </p>
                  )}
                  <p className="text-xs text-dark-textMuted mt-2">
                    Trend: {Math.abs(trajectory.slope_per_day).toFixed(2)} points/day{' '}
                    {trajectory.current_trend === 'improving' ? 'upward' : 'downward'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Assessment List */}
          <div>
            <h3 className="text-lg font-semibold text-dark-textPri mb-3">All Assessments</h3>
            <div className="space-y-3">
              {assessments.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-dark-accentDim flex items-center justify-center">
                          <span className="text-lg font-bold text-dark-accent">{a.score}</span>
                        </div>
                        <div>
                          <Badge variant={riskBandVariant(a.risk_band)}>{a.risk_band}</Badge>
                          <p className="text-xs text-dark-textMuted mt-1">{formatDate(a.created_at)}</p>
                        </div>
                      </div>
                      {i < assessments.length - 1 && (
                        <div className="text-sm">
                          {a.score > assessments[i + 1].score ? (
                            <span className="text-dark-green font-medium flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />+
                              {a.score - assessments[i + 1].score}
                            </span>
                          ) : a.score < assessments[i + 1].score ? (
                            <span className="text-dark-red font-medium flex items-center gap-1">
                              <TrendingDown className="w-4 h-4" />
                              {a.score - assessments[i + 1].score}
                            </span>
                          ) : (
                            <span className="text-dark-textMuted font-medium flex items-center gap-1">
                              <Minus className="w-4 h-4" />0
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
