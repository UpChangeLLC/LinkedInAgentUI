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
  allowOverflow?: boolean;
  onClick?: () => void;
}
export function Card({
  children,
  className,
  elevated = false,
  hoverable = false,
  allowOverflow = false,
  onClick
}: CardProps) {
  return (
    <motion.div
      whileHover={
      hoverable ?
      {
        y: -2,
        boxShadow:
        '0 0 20px rgba(20, 184, 166, 0.08)'
      } :
      undefined
      }
      transition={{
        duration: 0.2
      }}
      onClick={onClick}
      className={cn(
        'bg-dark-card rounded-xl border border-dark-border',
        allowOverflow ? 'overflow-visible' : 'overflow-hidden',
        elevated ? 'shadow-lg shadow-black/20' : '',
        hoverable ? 'cursor-pointer hover:border-dark-borderHov' : '',
        className
      )}>
      
      {children}
    </motion.div>);

}