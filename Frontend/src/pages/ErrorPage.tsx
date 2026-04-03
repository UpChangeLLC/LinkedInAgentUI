import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LinkedInNav } from '../components/ui/LinkedInNav';

interface ErrorPageProps {
  onRetry: () => void;
  onBack: () => void;
  errorMessage?: string;
}

export function ErrorPage({ onRetry, onBack, errorMessage }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-linkedin-bg">
      <LinkedInNav />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg mx-auto px-4 pt-24 pb-12 text-center"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-navy-900 mb-3">
            Unable to Complete Analysis
          </h1>

          <p className="text-gray-600 mb-2">
            We couldn't reach the analysis service. This could be due to high demand or a temporary issue.
          </p>

          {errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-6 mt-4">
              {errorMessage}
            </p>
          )}

          {!errorMessage && <div className="mb-6" />}

          <div className="flex flex-col gap-3">
            <Button onClick={onRetry} size="lg" fullWidth className="bg-[#0A66C2] hover:bg-[#004182]">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={onBack} variant="secondary" size="lg" fullWidth>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            If the problem persists, please try again in a few minutes.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
