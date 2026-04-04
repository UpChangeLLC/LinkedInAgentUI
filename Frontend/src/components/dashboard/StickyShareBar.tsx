import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Linkedin, Copy, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { MockResults } from '../../data/mockResults';
import { trackEvent } from '../../lib/analytics';

interface StickyShareBarProps {
  results: MockResults;
}

export function StickyShareBar({ results }: StickyShareBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const captureScoreCard = async (): Promise<Blob | null> => {
    // Look for the score card element rendered in ShareScoreCard
    const el =
      document.getElementById('score-card-capture') ||
      document.querySelector('[data-score-card]');
    if (!el) return null;

    try {
      const canvas = await html2canvas(el as HTMLElement, {
        backgroundColor: '#0B1120',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch {
      return null;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setSharing(true);

    // 1. Try to capture & download the score screenshot
    const blob = await captureScoreCard();
    if (blob) {
      const filename = `AI-Resilience-Score-${results.score}.png`;
      downloadBlob(blob, filename);
    }

    // 2. Open LinkedIn share compose with pre-filled text
    const text = `I just scored ${results.score}/100 on the AI Resilience Score™ (${results.personalRisk.personalRiskBand}). How AI-ready are you? 👉 airesiliencescore.com\n\n#AILeadership #FutureOfWork`;
    trackEvent('share_linkedin', { score: results.score, component: 'sticky_bar', screenshot: !!blob });
    window.open(
      `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
      '_blank'
    );

    setSharing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText('https://airesiliencescore.com');
    setCopied(true);
    trackEvent('share_copy_link', { score: results.score });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {!dismissed &&
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ delay: 2, type: 'spring', damping: 25 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dark-card border-t border-dark-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3"
      >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-dark-accentDim flex items-center justify-center flex-shrink-0">
                <Share2 className="w-5 h-5 text-dark-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dark-textPri truncate">
                  Share your score with your network
                </p>
                <p className="text-xs text-dark-textMuted hidden sm:block">
                  Executives who share are 3x more likely to attract AI-ready
                  talent
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg border border-dark-border hover:bg-dark-elevated transition-colors"
                title="Copy link"
              >
                {copied ?
                  <Check className="w-4 h-4 text-dark-green" /> :
                  <Copy className="w-4 h-4 text-dark-textMuted" />
                }
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-2 bg-dark-accent hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <Linkedin className="w-4 h-4" />
                <span className="hidden sm:inline">{sharing ? 'Preparing...' : 'Share on LinkedIn'}</span>
                <span className="sm:hidden">Share</span>
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-2 rounded-lg hover:bg-dark-elevated transition-colors ml-1"
              >
                <X className="w-4 h-4 text-dark-textMuted" />
              </button>
            </div>
          </div>
        </motion.div>
      }
    </AnimatePresence>
  );
}
