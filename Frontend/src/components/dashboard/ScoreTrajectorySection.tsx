import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { ScoreTrajectoryChart } from './ScoreTrajectoryChart'
import { ScoreDecayBanner } from './ScoreDecayBanner'
import { fetchTrajectory, trajectoryCaption, type TrajectoryEntry } from '../../lib/retention'

interface ScoreTrajectorySectionProps {
  urlHash?: string
  tier?: 'free' | 'premium'
  onRerun?: () => void
  /** Optional pre-loaded history (skips the fetch — useful for tests). */
  initialHistory?: TrajectoryEntry[]
}

function daysSince(iso?: string): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Number.isNaN(ms) ? 0 : Math.floor(ms / (24 * 60 * 60 * 1000))
}

/** Score-progression loop: shows the trajectory once a user has 2+ runs,
 * otherwise a placeholder. Also surfaces the score-decay nudge (spec 03 §3). */
export function ScoreTrajectorySection({ urlHash, tier = 'free', onRerun, initialHistory }: ScoreTrajectorySectionProps) {
  const [history, setHistory] = useState<TrajectoryEntry[]>(initialHistory ?? [])
  const [loaded, setLoaded] = useState(Boolean(initialHistory))

  useEffect(() => {
    if (initialHistory || !urlHash) return
    let active = true
    fetchTrajectory(urlHash).then((res) => {
      if (active) {
        setHistory(res.history)
        setLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [urlHash, initialHistory])

  if (!loaded) return null

  const caption = trajectoryCaption(history)
  const last = history[history.length - 1]
  const decayDays = daysSince(last?.computed_at)

  return (
    <div className="space-y-6">
      {onRerun && (
        <ScoreDecayBanner daysSinceLastRun={decayDays} onRerun={onRerun} tier={tier} />
      )}

      <section className="rounded-xl border border-dark-border bg-dark-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-linkedin" />
          <h3 className="text-sm font-semibold text-dark-textPri">Your trajectory</h3>
        </div>

        {history.length < 2 ? (
          <p className="text-sm text-dark-textMuted" data-test="trajectory-placeholder">
            Your trajectory will appear here once you re-run your score. Re-run in 30 days to start the trend.
          </p>
        ) : (
          <>
            <ScoreTrajectoryChart history={history} />
            {caption && (
              <p className="mt-3 text-sm text-dark-textSec">{caption} Re-run again in 30 days to keep the trend live.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
