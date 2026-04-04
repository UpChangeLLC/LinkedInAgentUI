import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}
export function Badge({
  children,
  variant = 'default',
  className
}: BadgeProps) {
  const variants = {
    default: 'bg-dark-accentDim text-dark-accent border-dark-accent/20',
    success: 'bg-dark-green/10 text-dark-green border-dark-green/20',
    warning: 'bg-dark-amber/10 text-dark-amber border-dark-amber/20',
    danger: 'bg-dark-red/10 text-dark-red border-dark-red/20',
    neutral: 'bg-dark-elevated text-dark-textSec border-dark-border'
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}>
      
      {children}
    </span>);

}