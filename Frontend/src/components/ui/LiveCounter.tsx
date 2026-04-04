import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

const env = (import.meta as any).env || {};
const baseUrl = ((env.VITE_MCP_BASE_URL as string) ?? '').replace(/\/+$/, '');

export function LiveCounter() {
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

  return (
    <div className="hidden md:flex items-center gap-2 bg-dark-elevated px-3 py-1.5 rounded-full border border-dark-border">
      <div className="relative">
        <Users className="w-4 h-4 text-dark-textMuted" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-dark-green rounded-full border-2 border-dark-bg animate-pulse"></span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-dark-textPri tabular-nums">
          {count.toLocaleString()}
        </span>
        <span className="text-xs text-dark-textMuted font-medium">
          execs analyzed
        </span>
      </div>
    </div>
  );
}
