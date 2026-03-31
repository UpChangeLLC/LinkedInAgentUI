import React from 'react';
import { motion } from 'framer-motion';
interface ScoreGaugeProps {
  score: number;
  riskBand: string;
}
export function ScoreGauge({ score, riskBand }: ScoreGaugeProps) {
  // Calculate color based on score
  const getColor = (s: number) => {
    if (s <= 40) return '#EF4444'; // Red
    if (s <= 60) return '#F59E0B'; // Amber
    if (s <= 80) return '#6C3AED'; // Accent (Violet)
    return '#10B981'; // Green
  };
  const color = getColor(score);
  // SVG parameters
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - score / 100 * circumference;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        {/* Background Circle */}
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90">
          
          <circle
            stroke="#E5E7EB"
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius} />
          
          <motion.circle
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            initial={{
              strokeDashoffset: circumference
            }}
            animate={{
              strokeDashoffset
            }}
            transition={{
              duration: 1.5,
              ease: 'easeOut'
            }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius} />
          
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{
              opacity: 0,
              scale: 0.5
            }}
            animate={{
              opacity: 1,
              scale: 1
            }}
            transition={{
              delay: 0.5,
              duration: 0.5
            }}
            className="text-5xl font-extrabold text-navy-900">
            
            {score}
          </motion.span>
        </div>
      </div>
      <motion.div
        initial={{
          opacity: 0,
          y: 10
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          delay: 1
        }}
        className="mt-4 text-center">
        
        <span
          className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
          style={{
            backgroundColor: `${color}20`,
            color: color
          }}>
          
          {riskBand}
        </span>
      </motion.div>
    </div>);

}