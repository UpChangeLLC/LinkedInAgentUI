import React from 'react';
import { motion } from 'framer-motion';
interface ProgressBarProps {
  progress: number;
  className?: string;
  animated?: boolean;
}
export function ProgressBar({
  progress,
  className = '',
  animated = false
}: ProgressBarProps) {
  return (
    <div
      className={`h-2 w-full bg-surface-muted rounded-full overflow-hidden ${className}`}>
      
      <motion.div
        initial={{
          width: 0
        }}
        animate={{
          width: `${progress}%`
        }}
        transition={{
          duration: 0.5,
          ease: 'easeInOut'
        }}
        className={`h-full bg-accent rounded-full ${animated ? 'animate-pulse' : ''}`} />
      
    </div>);

}