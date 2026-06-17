import { motion } from 'framer-motion';
import { Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Card } from '../components/ui/Card';

interface CachedResultPromptPageProps {
  age: string | null;
  onViewCached: () => void;
  onRunFresh: () => void;
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

export function CachedResultPromptPage({ age, onViewCached, onRunFresh }: CachedResultPromptPageProps) {
  return (
    <div className="min-h-screen bg-dark-bg">
      <LinkedInNav />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="py-12 px-4"
      >
        <div className="max-w-lg mx-auto">
          <Card className="p-8 md:p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-accentDim flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-dark-accent" />
            </div>

            <h2 className="text-2xl font-bold text-dark-textPri mb-2">
              Welcome back!
            </h2>
            <p className="text-dark-textSec mb-8">
              We have your AI Resilience Score from{' '}
              <span className="font-semibold text-dark-textPri">{formatAge(age)}</span>.
              Would you like to view those results or run a fresh analysis?
            </p>

            <div className="flex flex-col gap-3">
              <Button onClick={onViewCached} fullWidth size="lg">
                <span className="flex items-center justify-center gap-2">
                  View Previous Results
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

            <p className="mt-6 text-xs text-dark-textMuted">
              Fresh analysis takes about 60 seconds and provides the most up-to-date assessment.
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
