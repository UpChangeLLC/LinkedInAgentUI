import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { MockResults } from '../../data/mockResults';
import { Users, TrendingUp, Building2, AlertTriangle } from 'lucide-react';

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

interface PeerBenchmarkSectionProps {
  results: MockResults;
}

interface BenchmarkData {
  role: string;
  industry: string;
  sample_size: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
}

// Fallback mock averages when API is unavailable
const FALLBACK_INDUSTRY_AVG = 54;
const FALLBACK_ROLE_AVG = 48;
const FALLBACK_SIZE_AVG = 61;

export function PeerBenchmarkSection({ results }: PeerBenchmarkSectionProps) {
  const { personalProfile, score } = results;
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const params = new URLSearchParams();
        if (personalProfile.title) params.set('role', personalProfile.title);
        if (personalProfile.industry) params.set('industry', personalProfile.industry);

        if (!params.toString()) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${baseUrl}/api/benchmarks?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && data.sample_size > 0) {
            setBenchmark(data);
          }
        }
      } catch {
        // Fall back to mock data silently
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [personalProfile.title, personalProfile.industry]);

  const hasRealData = benchmark !== null && benchmark.sample_size > 0;
  const isLimitedData = hasRealData && benchmark.sample_size < 50;

  // Use real data when available, otherwise fall back to mock
  const roleAvg = hasRealData ? benchmark.mean : FALLBACK_ROLE_AVG;
  const industryAvg = hasRealData ? benchmark.median : FALLBACK_INDUSTRY_AVG;
  const sampleSize = hasRealData ? benchmark.sample_size : 12405;

  // Compute percentile approximation from real data
  const computePercentile = (userScore: number, avg: number, p25: number, p75: number): string => {
    if (!hasRealData) {
      // Fallback: approximate from average
      const diff = userScore - avg;
      if (diff >= 20) return 'Top 5%';
      if (diff >= 10) return 'Top 15%';
      if (diff >= 0) return 'Top 30%';
      if (diff >= -10) return 'Top 50%';
      return 'Top 70%';
    }
    if (userScore >= p75 + (p75 - p25)) return 'Top 5%';
    if (userScore >= p75) return 'Top 15%';
    if (userScore >= avg) return 'Top 30%';
    if (userScore >= p25) return 'Top 50%';
    return 'Top 70%';
  };

  const rolePercentile = hasRealData
    ? computePercentile(score, benchmark.mean, benchmark.p25, benchmark.p75)
    : 'Top 8%';

  const dateRangeLabel = hasRealData && benchmark.date_range.earliest && benchmark.date_range.latest
    ? `${new Date(benchmark.date_range.earliest).toLocaleDateString()} - ${new Date(benchmark.date_range.latest).toLocaleDateString()}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Peer Benchmarking
          </h2>
          <p className="text-gray-600">
            {hasRealData
              ? `Based on ${sampleSize.toLocaleString()} assessed professionals.`
              : `See how you stack up against ${sampleSize.toLocaleString()} other executives.`
            }
          </p>
          {dateRangeLabel && (
            <p className="text-xs text-gray-400 mt-1">Data from {dateRangeLabel}</p>
          )}
        </div>
      </div>

      {/* Limited data warning */}
      {isLimitedData && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Limited data: Only {benchmark.sample_size} matching profiles found.
            Benchmarks may not be statistically significant.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BenchmarkCard
          icon={Users}
          title="Vs. Industry Average"
          subtitle={personalProfile.industry}
          userScore={score}
          avgScore={industryAvg}
          percentile={hasRealData
            ? computePercentile(score, industryAvg, benchmark.p25, benchmark.p75)
            : 'Top 15%'
          }
        />
        <BenchmarkCard
          icon={TrendingUp}
          title="Vs. Role Average"
          subtitle={personalProfile.title}
          userScore={score}
          avgScore={roleAvg}
          percentile={rolePercentile}
        />
        <BenchmarkCard
          icon={Building2}
          title="Vs. Company Size"
          subtitle={personalProfile.companySize || '500-1000 employees'}
          userScore={score}
          avgScore={FALLBACK_SIZE_AVG}
          percentile="Top 42%"
        />
      </div>

      {/* Distribution Graph */}
      <Card className="p-6 md:p-8">
        <h3 className="font-bold text-gray-900 mb-6">
          Score Distribution: {personalProfile.title}s in{' '}
          {personalProfile.industry}
        </h3>

        <div className="relative h-48 w-full flex items-end justify-between gap-1 md:gap-2">
          {[10, 15, 25, 40, 65, 85, 95, 80, 60, 45, 30, 20, 10, 5].map(
            (height, i) => {
              const bucketStart = Math.round((i / 14) * 100);
              const bucketEnd = Math.round(((i + 1) / 14) * 100);
              const isUserBucket = score >= bucketStart && score < bucketEnd;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-2 group relative"
                >
                  {isUserBucket && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-linkedin text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10"
                    >
                      You ({score})
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-linkedin rotate-45"></div>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${height}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                    className={`w-full rounded-t-sm ${
                      isUserBucket
                        ? 'bg-linkedin'
                        : 'bg-gray-200 group-hover:bg-gray-300'
                    } transition-colors`}
                  />
                </div>
              );
            }
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 font-mono border-t border-gray-100 pt-2">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>

        {/* P25/P75 markers when real data available */}
        {hasRealData && (
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
            <span>P25: {benchmark.p25}</span>
            <span>Median: {benchmark.median}</span>
            <span>P75: {benchmark.p75}</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function BenchmarkCard({
  icon: Icon,
  title,
  subtitle,
  userScore,
  avgScore,
  percentile,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  userScore: number;
  avgScore: number;
  percentile: string;
}) {
  const diff = userScore - avgScore;
  const isPositive = diff >= 0;
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
          {percentile}
        </span>
      </div>

      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold text-gray-900">{userScore}</span>
        <span className="text-sm text-gray-500 mb-1">vs {avgScore} avg</span>
      </div>

      <div
        className={`text-xs font-medium ${
          isPositive ? 'text-green-600' : 'text-red-600'
        } flex items-center gap-1`}
      >
        {isPositive ? '+' : ''}
        {diff} points {isPositive ? 'higher' : 'lower'}
      </div>
    </Card>
  );
}
