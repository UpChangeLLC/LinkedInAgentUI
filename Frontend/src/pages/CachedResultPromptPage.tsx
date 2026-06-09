import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Card } from '../components/ui/Card';

interface CachedResultPromptPageProps {
  age: string | null;
  result?: Record<string, any> | null;
  onViewCached: () => void;
  onRunFresh: () => void;
  accountName?: string;
  onSubscriptions?: () => void;
}

function formatAge(isoDate: string | null): string {
  if (!isoDate) return 'recently';
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'less than an hour ago';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  return 'about a day ago';
}

export function CachedResultPromptPage({
  age,
  result,
  onViewCached,
  onRunFresh,
  accountName,
  onSubscriptions,
}: CachedResultPromptPageProps) {
  // Canonical v1 AI Resilience score (matches the dashboard); legacy fields are fallbacks.
  const score = result?.resilience_score ?? result?.profile_score ?? result?.score;
  const title =
    result?.personalProfile?.title ||
    result?.personal_profile?.title ||
    result?.title ||
    result?.overall_assessment?.best_fit_benchmark_role;
  const band = result?.risk_band ?? result?.riskBand;

  return (
    <div className="min-h-screen bg-dark-bg">
      <LinkedInNav accountName={accountName} onSubscriptions={onSubscriptions} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="py-12 px-4"
      >
        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden border border-dark-border bg-dark-card">
            <div className="p-8 md:p-10 border-b border-dark-border bg-gradient-to-br from-dark-card via-dark-accentDim/30 to-dark-bg">
              <div className="inline-flex items-center gap-2 rounded-full border border-dark-accent/20 bg-dark-bg/60 px-3 py-1.5 text-xs font-semibold text-dark-accent mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                Saved assessment found
              </div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-dark-textPri mb-3">
                Welcome back{accountName ? `, ${accountName.split(/\s+/)[0]}` : ''}
              </h2>
              <p className="text-dark-textSec max-w-2xl">
                We found your previous AI Resilience Score from{' '}
                <span className="font-semibold text-dark-textPri">{formatAge(age)}</span>.
                You can open the saved dashboard instantly or run a fresh analysis.
              </p>
            </div>

            {(score || title || band) && (
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {score && (
                    <div className="rounded-2xl border border-dark-border bg-dark-bg p-5">
                      <TrendingUp className="w-5 h-5 text-dark-accent mb-3" />
                      <p className="text-xs text-dark-textMuted">Saved score</p>
                      <p className="text-4xl font-bold text-dark-textPri">{score}</p>
                    </div>
                  )}
                  {band && (
                    <div className="rounded-2xl border border-dark-border bg-dark-bg p-5">
                      <Sparkles className="w-5 h-5 text-dark-accent mb-3" />
                      <p className="text-xs text-dark-textMuted">Risk band</p>
                      <p className="text-xl font-semibold text-dark-textPri">{band}</p>
                    </div>
                  )}
                  {title && (
                    <div className="rounded-2xl border border-dark-border bg-dark-bg p-5">
                      <CalendarClock className="w-5 h-5 text-dark-accent mb-3" />
                      <p className="text-xs text-dark-textMuted">Role</p>
                      <p className="text-base font-semibold text-dark-textPri line-clamp-2">{title}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button onClick={onViewCached} fullWidth size="lg">
                <span className="flex items-center justify-center gap-2">
                  View Saved Dashboard
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>

              <Button onClick={onRunFresh} fullWidth size="lg" variant="secondary">
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Run Fresh Analysis
                </span>
              </Button>
            </div>

            <p className="px-6 md:px-8 pb-8 text-xs text-dark-textMuted text-center">
              Fresh analysis takes about 60 seconds and updates your saved dashboard.
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
