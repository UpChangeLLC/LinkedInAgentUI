import { Check, Loader2 } from 'lucide-react'

export type ScrapeStatus = 'idle' | 'running' | 'parse_complete' | 'failed'

interface SurveyProgressBarProps {
  /** 1-based current step (e.g. 3 means "Question 3 of N"). */
  step: number
  total: number
  scrapeStatus: ScrapeStatus
}

/** Sticky header: per-step progress + parallel-scrape status badge.
 * The 'failed' state is intentionally not surfaced — when there's no Apify
 * token (or the scrape can't run), a persistent warning was just noise. */
export function SurveyProgressBar({ step, total, scrapeStatus }: SurveyProgressBarProps) {
  const pct = Math.round((step / total) * 100)

  const badge =
    scrapeStatus === 'running' ? (
      <span className="flex items-center gap-1.5 text-xs text-dark-textSec">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your profile
      </span>
    ) : scrapeStatus === 'parse_complete' ? (
      <span className="flex items-center gap-1.5 text-xs text-green-400">
        <Check className="h-3.5 w-3.5" /> Profile loaded
      </span>
    ) : null

  return (
    <div className="sticky top-0 z-10 border-b border-dark-border bg-dark-bg/90 px-5 py-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-dark-textSec">
          Question {step} of {total}
        </span>
        {badge}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dark-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-linkedin transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
