import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}
export function Card({
  children,
  className,
  elevated = false,
  hoverable = false,
  onClick
}: CardProps) {
  return (
    <motion.div
      whileHover={
      hoverable ?
      {
        y: -4,
        boxShadow:
        '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
      } :
      undefined
      }
      transition={{
        duration: 0.2
      }}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-surface-border overflow-hidden',
        elevated ? 'shadow-md' : 'shadow-sm',
        hoverable ? 'cursor-pointer' : '',
        className
      )}>
      
      {children}
    </motion.div>);

}