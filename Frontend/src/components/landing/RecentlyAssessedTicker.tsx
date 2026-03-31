import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const recentAssessments = [
{
  name: 'Sarah C.',
  role: 'COO',
  company: 'Series C Startup',
  score: 71
},
{
  name: 'Michael R.',
  role: 'CFO',
  company: 'Fortune 500',
  score: 58
},
{
  name: 'Priya K.',
  role: 'CTO',
  company: 'Enterprise SaaS',
  score: 84
},
{
  name: 'James W.',
  role: 'CEO',
  company: 'FinTech Scale-up',
  score: 45
},
{
  name: 'Lisa T.',
  role: 'CHRO',
  company: 'Healthcare Corp',
  score: 62
},
{
  name: 'David M.',
  role: 'CIO',
  company: 'Retail Giant',
  score: 77
},
{
  name: 'Ana S.',
  role: 'COO',
  company: 'AI Startup',
  score: 91
},
{
  name: 'Robert H.',
  role: 'CRO',
  company: 'B2B Platform',
  score: 53
}];

export function RecentlyAssessedTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % recentAssessments.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  const current = recentAssessments[currentIndex];
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };
  return (
    <div className="py-4 bg-white border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-3">
        <div className="relative flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Live
          </span>
        </div>

        <div className="h-8 overflow-hidden flex-1 max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              exit={{
                y: -20,
                opacity: 0
              }}
              transition={{
                duration: 0.3
              }}
              className="flex items-center justify-center gap-2 h-8">
              
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {current.name.charAt(0)}
              </div>
              <span className="text-sm text-gray-700">
                <span className="font-semibold">{current.name}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span>
                  {current.role} at {current.company}
                </span>
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreColor(current.score)}`}>
                
                {current.score}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>);

}