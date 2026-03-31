import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: {
    value: string;
    label: string;
  }[];
  placeholder?: string;
}
export function Select({
  className,
  label,
  error,
  options,
  placeholder,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label &&
      <label className="block text-sm font-medium text-navy-900 mb-1.5">
          {label}
        </label>
      }
      <div className="relative">
        <select
          className={cn(
            'w-full px-4 py-2.5 rounded-lg border bg-white text-navy-900 appearance-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all',
            error ?
            'border-red-300 focus:border-red-500 focus:ring-red-200' :
            'border-surface-border',
            props.value === '' ? 'text-gray-400' : 'text-navy-900',
            className
          )}
          {...props}>
          
          {placeholder &&
          <option value="" disabled>
              {placeholder}
            </option>
          }
          {options.map((opt) =>
          <option key={opt.value} value={opt.value} className="text-navy-900">
              {opt.label}
            </option>
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>);

}