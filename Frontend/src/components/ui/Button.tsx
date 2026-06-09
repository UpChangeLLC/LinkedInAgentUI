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
  /** Shows an inline spinner, disables the button, and sets aria-busy. */
  loading?: boolean;
}
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary:
    'bg-dark-accent hover:bg-teal-400 text-white shadow-md focus:ring-dark-accent',
    secondary:
    'border border-dark-border bg-dark-elevated text-dark-textPri hover:bg-dark-borderHov focus:ring-dark-accent',
    ghost: 'text-dark-accent hover:bg-dark-accentDim focus:ring-dark-accent'
  };
  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-6 text-base',
    lg: 'h-14 px-8 text-lg'
  };
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={{
        scale: isDisabled ? 1 : 1.02
      }}
      whileTap={{
        scale: isDisabled ? 1 : 0.98
      }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}>

      {loading && (
        <span
          className="mr-2 inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.button>);

}