import React from 'react';
import { motion } from 'framer-motion';
interface ScoreGaugeProps {
  score: number;
  riskBand: string;
}
export function ScoreGauge({ score, riskBand }: ScoreGaugeProps) {
  const getColor = (s: number) => {
    if (s <= 40) return '#F87171'; // Red
    if (s <= 60) return '#FBBF24'; // Amber
    if (s <= 80) return '#14B8A6'; // Teal accent
    return '#34D399'; // Green
  };
  const color = getColor(score);
  // 192px diameter gauge
  const size = 192;
  const radius = size / 2;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - score / 100 * circumference;
  const glowId = `gauge-glow-${score}`;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        <svg
          height={size}
          width={size}
          className="transform -rotate-90">
          <defs>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            stroke="#1E293B"
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius} />
          <motion.circle
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            filter={`url(#${glowId})`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-6xl font-bold font-serif text-dark-textPri">
            {score}
          </motion.span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="mt-4 text-center">
        <span
          className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{
            backgroundColor: `${color}18`,
            color: color
          }}>
          {riskBand}
        </span>
      </motion.div>
    </div>);

}