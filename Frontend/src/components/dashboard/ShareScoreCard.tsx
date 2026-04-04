import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Linkedin, Download, Link2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { trackEvent } from '../../lib/analytics';
import { MockResults } from '../../data/mockResults';

const BASE_URL = (import.meta as any).env?.VITE_MCP_BASE_URL || '';

interface ShareScoreCardProps {
  results: MockResults;
  runId?: string;
}

export function ShareScoreCard({ results, runId }: ShareScoreCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { personalProfile, personalRisk, score } = results;
  const effectiveRunId = runId || results.urlHash || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `I just got my AI Resilience Score: ${score}/100. Check your executive AI readiness here: https://airesiliencescore.com`
    );
    setCopied(true);
    trackEvent('share_copy_link', { score });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    // Capture score card screenshot
    const el = document.getElementById('score-card-capture');
    if (el) {
      try {
        const canvas = await html2canvas(el as HTMLElement, {
          backgroundColor: '#0B1120',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AI-Resilience-Score-${score}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch {
        // Screenshot capture failed — continue to open LinkedIn
      }
    }

    const text = `I just analyzed my AI leadership readiness. My AI Resilience Score is ${score}/100 (${personalRisk.personalRiskBand}). \n\nSee how you stack up against other ${personalProfile.title}s in ${personalProfile.industry}.\n\n#AILeadership #ExecutiveResilience #FutureOfWork`;
    const shareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    trackEvent('share_linkedin', { score, component: 'share_card' });
    window.open(shareUrl, '_blank');
  };

  const handleDownloadPdf = async () => {
    if (!effectiveRunId) return;
    setDownloading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/reports/${effectiveRunId}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI-Resilience-Report-${effectiveRunId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      trackEvent('download_pdf', { runId: effectiveRunId });
    } catch {
      // Silently fail
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* The Visual Card */}
        <motion.div
          id="score-card-capture"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full md:w-2/3 aspect-[1.91/1] bg-dark-bg rounded-xl overflow-hidden relative shadow-2xl flex flex-col text-white p-6 md:p-8 border border-dark-border"
        >
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-dark-accent/15 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2" />

          {/* Header */}
          <div className="flex justify-between items-center mb-auto relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-dark-accent rounded-[2px] flex items-center justify-center">
                <span className="text-dark-bg font-bold text-xs pb-0.5">in</span>
              </div>
              <span className="font-semibold tracking-wide text-dark-textSec">
                AI Resilience Score™
              </span>
            </div>
            <div className="text-xs font-mono text-dark-accent uppercase tracking-widest border border-dark-accent/30 px-2 py-1 rounded">
              Official Report
            </div>
          </div>

          {/* Center Content */}
          <div className="flex flex-col items-center justify-center text-center relative z-10 my-4">
            <div className="relative w-32 h-32 md:w-40 md:h-40 mb-4 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#1E293B" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#14B8A6" strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={283 - 283 * score / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl md:text-5xl font-bold font-serif">{score}</span>
                <span className="text-xs text-dark-textMuted uppercase tracking-wider mt-1">/100</span>
              </div>
            </div>

            <div className="inline-block bg-dark-accent/20 text-dark-accent px-4 py-1.5 rounded-full font-bold text-sm md:text-base border border-dark-accent/30 mb-6">
              {personalRisk.personalRiskBand}
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-md border-t border-dark-border pt-4">
              <div className="text-center">
                <div className="text-xs text-dark-textMuted mb-1">Role Risk</div>
                <div className="font-bold text-lg">{personalRisk.roleAutomationRisk}%</div>
              </div>
              <div className="text-center border-l border-dark-border">
                <div className="text-xs text-dark-textMuted mb-1">Adaptability</div>
                <div className="font-bold text-lg">{personalRisk.adaptabilityIndex}</div>
              </div>
              <div className="text-center border-l border-dark-border">
                <div className="text-xs text-dark-textMuted mb-1">Governance</div>
                <div className="font-bold text-lg">40</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end mt-auto relative z-10 pt-4">
            <div>
              <div className="font-bold text-lg">{personalProfile.name}</div>
              <div className="text-sm text-dark-textMuted">
                {personalProfile.title} at {personalProfile.company}
              </div>
            </div>
            <div className="text-xs text-dark-textMuted font-mono">airesiliencescore.com</div>
          </div>
        </motion.div>

        {/* Share Controls */}
        <div className="w-full md:w-1/3 space-y-4">
          <Card className="p-6">
            <h3 className="font-bold text-dark-textPri mb-2">Share your achievement</h3>
            <p className="text-sm text-dark-textSec mb-4">
              Executives who share their AI readiness score are 3x more likely to attract top technical talent.
            </p>

            <div className="bg-dark-elevated p-3 rounded-lg border border-dark-border mb-4 text-xs text-dark-textMuted italic">
              "I just analyzed my AI leadership readiness. My AI Resilience Score is {score}/100. See how you stack up..."
            </div>

            <div className="space-y-3">
              <Button fullWidth onClick={handleShare} className="flex items-center justify-center gap-2">
                <Linkedin className="w-4 h-4" />
                Share on LinkedIn
              </Button>

              {effectiveRunId && (
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? 'Downloading...' : 'Download PDF Report'}
                </Button>
              )}

              <Button
                fullWidth
                variant="ghost"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-dark-green" /> : <Link2 className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </Card>

          <div className="bg-dark-accentDim p-4 rounded-xl border border-dark-accent/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-dark-green animate-pulse" />
              <span className="text-xs font-bold text-dark-accent uppercase">
                Trending Now
              </span>
            </div>
            <p className="text-sm text-dark-textSec">
              <span className="font-bold text-dark-textPri">1,240</span> other{' '}
              {personalProfile.title}s checked their score today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
