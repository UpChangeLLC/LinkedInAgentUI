import { Check, Loader2, AlertTriangle } from 'lucide-react'

export type ScrapeStatus = 'idle' | 'running' | 'parse_complete' | 'failed'

interface SurveyProgressBarProps {
  answered: number
  total: number
  scrapeStatus: ScrapeStatus
}

/** Sticky header: question progress + the parallel-scrape status badge that
 * reassures users the background profile fetch is working (spec 01 §4.6). */
export function SurveyProgressBar({ answered, total, scrapeStatus }: SurveyProgressBarProps) {
  const pct = Math.round((answered / total) * 100)

  const badge = {
    idle: null,
    running: (
      <span className="flex items-center gap-1.5 text-xs text-white/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your profile
      </span>
    ),
    parse_complete: (
      <span className="flex items-center gap-1.5 text-xs text-green-400">
        <Check className="h-3.5 w-3.5" /> Profile loaded
      </span>
    ),
    failed: (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" /> We'll retry
      </span>
    ),
  }[scrapeStatus]

  return (
    <div className="sticky top-0 z-10 border-b border-white/10 bg-dark-bg/90 px-5 py-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white/80">
          Question {Math.min(answered + 1, total)} of {total}
        </span>
        {badge}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-linkedin transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
