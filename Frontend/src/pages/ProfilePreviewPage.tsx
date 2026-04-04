import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ProfileCard } from '../components/ui/ProfileCard';
import { LinkedInNav } from '../components/ui/LinkedInNav';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import type { ProfilePreview } from '../lib/mcp';

interface ProfilePreviewPageProps {
  preview: ProfilePreview;
  linkedinUrl: string;
  onConfirm: () => void;
  onReject: () => void;
  onBack: () => void;
}

export function ProfilePreviewPage({
  preview,
  linkedinUrl,
  onConfirm,
  onReject,
  onBack,
}: ProfilePreviewPageProps) {
  const isLowCompleteness = preview.completeness_score < 30;

  return (
    <div className="min-h-screen bg-linkedin-bg">
      <LinkedInNav />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="py-12 px-4"
      >
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>

          <Card className="p-8 md:p-10 shadow-sm border border-gray-200 bg-white">
            {/* Step indicator */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-sm font-semibold text-linkedin uppercase tracking-wider">
                  Step 2 of 3
                </h2>
                <span className="text-sm text-gray-400">66% Completed</span>
              </div>
              <ProgressBar progress={66} />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Is this your profile?
              </h1>
              <p className="text-gray-600">
                We found this LinkedIn profile. Please confirm it's correct before
                we run the full AI Resilience analysis.
              </p>
            </div>

            {/* Profile card */}
            <div className="mb-6">
              <ProfileCard profile={preview} />
            </div>

            {/* Low completeness warning */}
            {isLowCompleteness && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Limited Profile Data
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This profile has limited public information. The analysis may be
                    less accurate. Consider adding a resume for better results.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={onConfirm}
                fullWidth
                size="lg"
                className="bg-[#0A66C2] hover:bg-[#004182]"
              >
                <span className="flex items-center justify-center gap-2">
                  Yes, Analyze This Profile
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
              <Button
                onClick={onReject}
                fullWidth
                size="lg"
                variant="secondary"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Not Me, Try Again
                </span>
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Only public profile information is used for analysis
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
