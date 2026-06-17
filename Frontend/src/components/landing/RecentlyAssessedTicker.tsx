import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getScoreColor } from '../../lib/scoreUtils';

interface Assessment {
  role_category: string;
  score: number | null;
  created_at: string | null;
}

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

export function RecentlyAssessedTicker() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.recent_assessments) && data.recent_assessments.length > 0) {
            setAssessments(data.recent_assessments);
          }
        }
      } catch { /* ignore */ }
    };
    fetchRecent();
    const poll = setInterval(fetchRecent, 30_000);
    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  useEffect(() => {
    if (assessments.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % assessments.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [assessments.length]);

  if (assessments.length === 0) {
    return (
      <div className="py-4 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="text-sm text-gray-500">
            Be the first to get your AI Resilience Score
          </span>
        </div>
      </div>
    );
  }

  const current = assessments[currentIndex];
  const score = current?.score ?? 0;

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
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-2 h-8"
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {(current.role_category || '?').charAt(0)}
              </div>
              <span className="text-sm text-gray-700">
                <span className="font-semibold">{current.role_category || 'Executive'}</span>
                <span className="text-gray-400 mx-1">&middot;</span>
                <span>scored {score}/100</span>
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreColor(score)}`}>
                {score}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
