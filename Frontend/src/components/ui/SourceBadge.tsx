import type { DataSourceType } from '../../data/mockResults';

const SOURCE_CONFIG: Record<DataSourceType, { label: string; bg: string; text: string; tooltip: string }> = {
  linkedin: {
    label: 'LinkedIn',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    tooltip: 'Data extracted from LinkedIn profile',
  },
  resume: {
    label: 'Resume',
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    tooltip: 'Data extracted from uploaded resume',
  },
  ai_inferred: {
    label: 'AI Inferred',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    tooltip: 'Inferred by AI analysis based on available data',
  },
  market_data: {
    label: 'Market Data',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
    tooltip: 'Based on industry and market intelligence',
  },
};

interface SourceBadgeProps {
  source: DataSourceType;
  size?: 'sm' | 'md';
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.ai_inferred;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${config.bg} ${config.text} ${sizeClasses}`}
      title={config.tooltip}
    >
      {config.label}
    </span>
  );
}
