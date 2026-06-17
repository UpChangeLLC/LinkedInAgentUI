import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

export function LiveCounter() {
  return <LiveCounterBase />;
}

interface LiveCounterProps {
  compact?: boolean;
  showOnMobile?: boolean;
  optimisticDelta?: number;
  className?: string;
}

export function LiveCounterBase({
  compact = false,
  showOnMobile = false,
  optimisticDelta = 0,
  className = '',
}: LiveCounterProps = {}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && typeof data.total_assessments === 'number') {
            setCount(data.total_assessments);
          }
        }
      } catch {
        // Silently ignore — counter just won't show
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (count === null || count === 0) return null;
  const displayCount = Math.max(0, count + optimisticDelta);
  const wrapperVisibility = showOnMobile ? 'flex' : 'hidden md:flex';
  const spacingClass = compact ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const valueClass = compact ? 'text-xs md:text-sm' : 'text-sm';
  const labelText = compact ? 'analyzed' : 'execs analyzed';

  return (
    <div
      className={`${wrapperVisibility} items-center gap-2 bg-dark-elevated ${spacingClass} rounded-full border border-dark-border ${className}`.trim()}
      aria-live="polite"
      aria-label={`${displayCount.toLocaleString()} executives analyzed`}
    >
      <div className="relative">
        <Users className="w-4 h-4 text-dark-textMuted" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-dark-green rounded-full border-2 border-dark-bg animate-pulse"></span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`${valueClass} font-bold text-dark-textPri tabular-nums`}>
          {displayCount.toLocaleString()}
        </span>
        <span className="text-xs text-dark-textMuted font-medium">
          {labelText}
        </span>
      </div>
    </div>
  );
}
