import { Check } from 'lucide-react'

export type ScrapeStatus = 'idle' | 'running' | 'parse_complete' | 'failed'

interface SurveyProgressBarProps {
  /** 1-based current step (e.g. 3 means "Question 3 of N"). */
  step: number
  total: number
  scrapeStatus: ScrapeStatus
}

/** Mock-aligned progress card (mock §SCREEN 3): step counter + scrape badge
 * with a pulsing dot while running. The 'failed' state stays hidden — it was
 * just noise when no Apify token is configured. */
export function SurveyProgressBar({ step, total, scrapeStatus }: SurveyProgressBarProps) {
  const pct = Math.round((step / total) * 100)

  const badge =
    scrapeStatus === 'running' ? (
      <div className="flex items-center gap-1.5 text-linkedin">
        <span className="block h-2 w-2 rounded-full bg-linkedin animate-pulse" aria-hidden />
        <span className="text-[12px] font-medium">Reading your profile…</span>
      </div>
    ) : scrapeStatus === 'parse_complete' ? (
      <div className="flex items-center gap-1.5 text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        <span className="text-[12px] font-medium">Profile loaded</span>
      </div>
    ) : null

  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <div className="flex items-center justify-between text-xs font-medium">
        <div>
          <span className="text-gray-700">Question </span>
          <span className="text-gray-900 font-semibold">{step}</span>
          <span className="text-gray-500"> of </span>
          <span className="text-gray-900 font-semibold">{total}</span>
        </div>
        {badge}
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-off"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-linkedin transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
