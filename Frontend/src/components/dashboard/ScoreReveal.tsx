import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MockResults } from '../../data/mockResults';
interface ScoreRevealProps {
  results: MockResults;
  onComplete: () => void;
}
export function ScoreReveal({ results, onComplete }: ScoreRevealProps) {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<'counting' | 'reveal' | 'done'>('counting');
  useEffect(() => {
    // Count up animation
    const targetScore = results.score;
    const duration = 2000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * targetScore));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setPhase('reveal');
        setTimeout(() => {
          setPhase('done');
          setTimeout(onComplete, 800);
        }, 1500);
      }
    };
    // Brief pause before counting
    const timeout = setTimeout(() => requestAnimationFrame(animate), 600);
    return () => clearTimeout(timeout);
  }, [results.score, onComplete]);
  const getRiskColor = () => {
    if (results.score >= 75) return 'from-green-400 to-emerald-500';
    if (results.score >= 50) return 'from-amber-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };
  return (
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      className="fixed inset-0 z-[100] bg-navy-900 flex flex-col items-center justify-center">
      
      {/* Background pulse */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={
        phase === 'reveal' ?
        {
          scale: [1, 1.5],
          opacity: [0.2, 0]
        } :
        {}
        }
        transition={{
          duration: 1
        }}>
        
        <div
          className={`w-64 h-64 rounded-full bg-gradient-to-br ${getRiskColor()} blur-[80px] opacity-20`} />
        
      </motion.div>

      <div className="relative z-10 text-center">
        <motion.p
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="text-linkedin-light text-sm font-mono uppercase tracking-[0.3em] mb-8">
          
          Your AI Resilience Score
        </motion.p>

        {/* Score Number */}
        <motion.div
          className="relative mb-6"
          animate={
          phase === 'reveal' ?
          {
            scale: [1, 1.1, 1]
          } :
          {}
          }
          transition={{
            duration: 0.5
          }}>
          
          {/* Ring */}
          <svg
            className="w-48 h-48 md:w-56 md:h-56 mx-auto -rotate-90"
            viewBox="0 0 100 100">
            
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#1e3a6a"
              strokeWidth="4" />
            
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#0A66C2"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="276.5"
              initial={{
                strokeDashoffset: 276.5
              }}
              animate={{
                strokeDashoffset: 276.5 - 276.5 * results.score / 100
              }}
              transition={{
                duration: 2,
                ease: [0.33, 1, 0.68, 1]
              }} />
            
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl md:text-7xl font-extrabold text-white tabular-nums">
              {count}
            </span>
          </div>
        </motion.div>

        {/* Risk Band */}
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.8
          }}
          animate={
          phase === 'reveal' || phase === 'done' ?
          {
            opacity: 1,
            scale: 1
          } :
          {
            opacity: 0,
            scale: 0.8
          }
          }
          transition={{
            duration: 0.4
          }}
          className="mb-6">
          
          <span className="inline-block bg-white/10 backdrop-blur-sm text-white px-6 py-2 rounded-full font-semibold text-lg border border-white/20">
            {results.riskBand}
          </span>
        </motion.div>

        {/* Percentile */}
        <motion.p
          initial={{
            opacity: 0
          }}
          animate={
          phase === 'reveal' || phase === 'done' ?
          {
            opacity: 1
          } :
          {
            opacity: 0
          }
          }
          transition={{
            delay: 0.3
          }}
          className="text-gray-400 text-base">
          
          You scored higher than{' '}
          <span className="text-white font-bold">67%</span> of executives in
          your industry
        </motion.p>

        {/* Loading into dashboard */}
        <motion.p
          initial={{
            opacity: 0
          }}
          animate={
          phase === 'done' ?
          {
            opacity: 1
          } :
          {
            opacity: 0
          }
          }
          className="text-gray-500 text-sm mt-8 font-mono">
          
          Loading your full report...
        </motion.p>
      </div>
    </motion.div>);

}