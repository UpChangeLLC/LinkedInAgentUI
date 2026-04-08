import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, ArrowLeft, WifiOff, Lock, Clock, ServerCrash, Link2Off } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LinkedInNav } from '../components/ui/LinkedInNav';

interface ErrorPageProps {
  onRetry: () => void;
  onBack: () => void;
  errorMessage?: string;
  errorType?: string;
}

const ERROR_CONFIG: Record<string, { icon: typeof AlertTriangle; title: string; description: string; color: string }> = {
  network_timeout: {
    icon: WifiOff,
    title: 'Connection Timed Out',
    description: 'The request took too long. Check your internet connection and try again.',
    color: 'amber',
  },
  linkedin_private: {
    icon: Lock,
    title: 'Profile Not Accessible',
    description: 'This LinkedIn profile appears to be private or was not found. Please try a public profile URL.',
    color: 'amber',
  },
  rate_limited: {
    icon: Clock,
    title: 'Too Many Requests',
    description: 'Please wait a moment before trying again. We limit requests to ensure quality results.',
    color: 'amber',
  },
  llm_failure: {
    icon: ServerCrash,
    title: 'Analysis Engine Busy',
    description: 'Our AI analysis engine is temporarily unavailable. This usually resolves within a minute.',
    color: 'amber',
  },
  invalid_url: {
    icon: Link2Off,
    title: 'Invalid LinkedIn URL',
    description: 'That doesn\'t look like a valid LinkedIn profile URL. Please use a URL like linkedin.com/in/username.',
    color: 'red',
  },
  missing_input: {
    icon: Link2Off,
    title: 'LinkedIn URL Required',
    description: 'Please paste your LinkedIn profile URL (linkedin.com/in/your-name) to run the analysis.',
    color: 'amber',
  },
  server_error: {
    icon: AlertTriangle,
    title: 'Unable to Complete Analysis',
    description: 'Something went wrong on our end. We\'ve been notified and are looking into it.',
    color: 'red',
  },
};

export function ErrorPage({ onRetry, onBack, errorMessage, errorType }: ErrorPageProps) {
  const config = ERROR_CONFIG[errorType || ''] || ERROR_CONFIG.server_error;
  const Icon = config.icon;
  const bgColor = config.color === 'amber' ? 'bg-amber-50' : 'bg-red-50';
  const iconColor = config.color === 'amber' ? 'text-amber-500' : 'text-red-500';
  const borderColor = config.color === 'amber' ? 'border-amber-100' : 'border-red-100';
  const msgBg = config.color === 'amber' ? 'bg-amber-50' : 'bg-red-50';
  const msgText = config.color === 'amber' ? 'text-amber-700' : 'text-red-600';

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
        <div className={`bg-white rounded-2xl shadow-sm border ${borderColor} p-8`}>
          <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center mx-auto mb-6`}>
            <Icon className={`w-8 h-8 ${iconColor}`} />
          </div>

          <h1 className="text-2xl font-bold text-navy-900 mb-3">
            {config.title}
          </h1>

          <p className="text-gray-600 mb-2">
            {config.description}
          </p>

          {errorMessage && (
            <p className={`text-sm ${msgText} ${msgBg} rounded-lg p-3 mb-6 mt-4`}>
              {errorMessage}
            </p>
          )}

          {!errorMessage && <div className="mb-6" />}

          <div className="flex flex-col gap-3">
            <Button onClick={onRetry} size="lg" fullWidth className="bg-[#0A66C2] hover:bg-[#004182]">
              <RefreshCw className="w-4 h-4 mr-2" />
              {errorType === 'invalid_url' ? 'Edit URL' : 'Try Again'}
            </Button>
            <Button onClick={onBack} variant="secondary" size="lg" fullWidth>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            {errorType === 'rate_limited'
              ? 'You can try again in about 60 seconds.'
              : 'If the problem persists, please try again in a few minutes.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
