import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary:
    'bg-dark-accent hover:bg-teal-400 text-dark-bg shadow-md focus:ring-dark-accent',
    secondary:
    'border border-dark-border bg-dark-elevated text-dark-textPri hover:bg-dark-borderHov focus:ring-dark-accent',
    ghost: 'text-dark-accent hover:bg-dark-accentDim focus:ring-dark-accent'
  };
  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-6 text-base',
    lg: 'h-14 px-8 text-lg'
  };
  return (
    <motion.button
      whileHover={{
        scale: props.disabled ? 1 : 1.02
      }}
      whileTap={{
        scale: props.disabled ? 1 : 0.98
      }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}>
      
      {children}
    </motion.button>);

}