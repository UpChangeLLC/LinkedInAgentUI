import { useState } from 'react'
import { Clock, X } from 'lucide-react'

interface NewsAnchor {
  title: string
  url: string
}

interface ScoreDecayBannerProps {
  daysSinceLastRun: number
  onRerun: () => void
  newsAnchors?: NewsAnchor[]
  tier: 'free' | 'premium'
}

const DISMISS_KEY = 'upchange.decay.dismissedAt'

/** Score-decay nudge: appears once a score is >30 days old, dismissible for 24h.
 * Frames urgency around AI movement (news anchors), not the user falling behind. */
export function ScoreDecayBanner({ daysSinceLastRun, onRerun, newsAnchors = [], tier }: ScoreDecayBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      return at > Date.now() - 24 * 60 * 60 * 1000
    } catch {
      return false
    }
  })

  if (daysSinceLastRun < 30 || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 p-4" data-test="score-decay-banner">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 text-white/40 hover:text-white/70">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Your score is {daysSinceLastRun} days old.</p>
          <p className="mt-1 text-sm text-white/60">
            AI tooling moved fast over the last month. Re-run your assessment to see how your role's exposure
            has shifted.
          </p>
          {newsAnchors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-white/50">
              {newsAnchors.slice(0, 2).map((n) => (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-white/80">• {n.title}</a>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={onRerun}
            className="mt-3 rounded-lg bg-linkedin px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Re-run my assessment
          </button>
          {tier === 'free' && (
            <p className="mt-2 text-xs text-white/40">Free users can re-run once every 30 days. Premium = unlimited.</p>
          )}
        </div>
      </div>
    </div>
  )
}
