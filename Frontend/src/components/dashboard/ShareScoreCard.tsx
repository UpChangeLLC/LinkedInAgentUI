import React, { useState, Component } from 'react';
import { motion } from 'framer-motion';
import { Share2, Copy, Check, Linkedin } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { trackEvent } from '../../lib/analytics';
import { Badge } from '../ui/Badge';
import { MockResults } from '../../data/mockResults';
interface ShareScoreCardProps {
  results: MockResults;
}
export function ShareScoreCard({ results }: ShareScoreCardProps) {
  const [copied, setCopied] = useState(false);
  const { personalProfile, personalRisk, score } = results;
  const handleCopy = () => {
    navigator.clipboard.writeText(
      `I just got my AI Resilience Score: ${score}/100. Check your executive AI readiness here: https://airesiliencescore.com`
    );
    setCopied(true);
    trackEvent('share_copy_link', { score });
    setTimeout(() => setCopied(false), 2000);
  };
  const handleShare = () => {
    const text = `I just analyzed my AI leadership readiness. My AI Resilience Score is ${score}/100 (${personalRisk.personalRiskBand}). \n\nSee how you stack up against other ${personalProfile.title}s in ${personalProfile.industry}.\n\n#AILeadership #ExecutiveResilience #FutureOfWork`;
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    trackEvent('share_linkedin', { score, component: 'share_card' });
    window.open(url, '_blank');
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* The Visual Card (Designed to look like a shareable image) */}
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95
          }}
          animate={{
            opacity: 1,
            scale: 1
          }}
          className="w-full md:w-2/3 aspect-[1.91/1] bg-navy-900 rounded-xl overflow-hidden relative shadow-2xl flex flex-col text-white p-6 md:p-8 border border-navy-800">
          
          {/* Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-linkedin/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>

          {/* Header */}
          <div className="flex justify-between items-center mb-auto relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-linkedin rounded-[2px] flex items-center justify-center">
                <span className="text-white font-bold text-xs pb-0.5">in</span>
              </div>
              <span className="font-semibold tracking-wide text-gray-200">
                AI Resilience Score™
              </span>
            </div>
            <div className="text-xs font-mono text-linkedin-light uppercase tracking-widest border border-linkedin-light/30 px-2 py-1 rounded">
              Official Report
            </div>
          </div>

          {/* Center Content */}
          <div className="flex flex-col items-center justify-center text-center relative z-10 my-4">
            <div className="relative w-32 h-32 md:w-40 md:h-40 mb-4 flex items-center justify-center">
              {/* Simple SVG Gauge */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#1e3a6a"
                  strokeWidth="8" />
                
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#0A66C2"
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={283 - 283 * score / 100}
                  strokeLinecap="round" />
                
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl md:text-5xl font-bold">{score}</span>
                <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">
                  /100
                </span>
              </div>
            </div>

            <div className="inline-block bg-linkedin/20 text-linkedin-light px-4 py-1.5 rounded-full font-bold text-sm md:text-base border border-linkedin/30 mb-6">
              {personalRisk.personalRiskBand}
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-md border-t border-white/10 pt-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Role Risk</div>
                <div className="font-bold text-lg">
                  {personalRisk.roleAutomationRisk}%
                </div>
              </div>
              <div className="text-center border-l border-white/10">
                <div className="text-xs text-gray-400 mb-1">Adaptability</div>
                <div className="font-bold text-lg">
                  {personalRisk.adaptabilityIndex}
                </div>
              </div>
              <div className="text-center border-l border-white/10">
                <div className="text-xs text-gray-400 mb-1">Governance</div>
                <div className="font-bold text-lg">40</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end mt-auto relative z-10 pt-4">
            <div>
              <div className="font-bold text-lg">{personalProfile.name}</div>
              <div className="text-sm text-gray-400">
                {personalProfile.title} at {personalProfile.company}
              </div>
            </div>
            <div className="text-xs text-gray-500 font-mono">
              airesiliencescore.com
            </div>
          </div>
        </motion.div>

        {/* Share Controls */}
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="p-6 bg-white border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">
              Share your achievement
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Executives who share their AI readiness score are 3x more likely
              to attract top technical talent.
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-xs text-gray-600 italic">
              "I just analyzed my AI leadership readiness. My AI Resilience
              Score is {score}/100. See how you stack up..."
            </div>

            <div className="space-y-3">
              <Button
                fullWidth
                onClick={handleShare}
                className="bg-[#0A66C2] hover:bg-[#004182] flex items-center justify-center gap-2">
                
                <Linkedin className="w-4 h-4" />
                Share on LinkedIn
              </Button>

              <Button
                fullWidth
                variant="secondary"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2">
                
                {copied ?
                <Check className="w-4 h-4 text-green-600" /> :

                <Copy className="w-4 h-4" />
                }
                {copied ? 'Copied to clipboard' : 'Copy Link'}
              </Button>
            </div>
          </Card>

          <div className="bg-gradient-to-br from-linkedin/5 to-purple-50 p-4 rounded-xl border border-linkedin/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-bold text-linkedin-dark uppercase">
                Trending Now
              </span>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-bold">1,240</span> other{' '}
              {personalProfile.title}s checked their score today.
            </p>
          </div>
        </div>
      </div>
    </div>);

}