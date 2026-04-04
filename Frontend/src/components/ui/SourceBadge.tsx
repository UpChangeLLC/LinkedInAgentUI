import type { DataSourceType } from '../../data/mockResults';

const SOURCE_CONFIG: Record<DataSourceType, { label: string; bg: string; text: string; tooltip: string }> = {
  linkedin: {
    label: 'LinkedIn',
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-400',
    tooltip: 'Data extracted from LinkedIn profile',
  },
  resume: {
    label: 'Resume',
    bg: 'bg-dark-green/10 border-dark-green/20',
    text: 'text-dark-green',
    tooltip: 'Data extracted from uploaded resume',
  },
  ai_inferred: {
    label: 'AI Inferred',
    bg: 'bg-dark-amber/10 border-dark-amber/20',
    text: 'text-dark-amber',
    tooltip: 'Inferred by AI analysis based on available data',
  },
  market_data: {
    label: 'Market Data',
    bg: 'bg-purple-500/10 border-purple-500/20',
    text: 'text-purple-400',
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
