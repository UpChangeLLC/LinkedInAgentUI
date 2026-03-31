import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ className, label, error, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label &&
      <label className="block text-sm font-medium text-navy-900 mb-1.5">
          {label}
        </label>
      }
      <input
        className={cn(
          'w-full px-4 py-2.5 rounded-lg border bg-white text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all',
          error ?
          'border-red-300 focus:border-red-500 focus:ring-red-200' :
          'border-surface-border',
          className
        )}
        {...props} />
      
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>);

}