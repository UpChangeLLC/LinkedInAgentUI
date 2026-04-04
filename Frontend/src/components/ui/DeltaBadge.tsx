import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  delta: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DeltaBadge({ delta, label, size = 'md' }: DeltaBadgeProps) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isFlat = delta === 0;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const colorClasses = isPositive
    ? 'bg-green-50 text-green-700 border-green-200'
    : isNegative
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-gray-50 text-gray-500 border-gray-200';

  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${colorClasses} ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {isPositive ? '+' : ''}{delta}
      {label && <span className="font-normal ml-0.5">{label}</span>}
    </span>
  );
}
