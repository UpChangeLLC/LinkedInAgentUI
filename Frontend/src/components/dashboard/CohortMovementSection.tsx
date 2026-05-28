import { useEffect, useState } from 'react'
import { Users, ChevronDown } from 'lucide-react'
import { CohortDistributionChart } from './CohortDistributionChart'
import { fetchCohort, type CohortResponse } from '../../lib/retention'

interface CohortMovementSectionProps {
  role?: string
  userScore: number
  initialCohort?: CohortResponse
}

/** Loop 2 — social proof: where the user stands among peers in their role. */
export function CohortMovementSection({ role = '', userScore, initialCohort }: CohortMovementSectionProps) {
  const [cohort, setCohort] = useState<CohortResponse | null>(initialCohort ?? null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (initialCohort) return
    let active = true
    fetchCohort(role, userScore).then((res) => {
      if (active) setCohort(res)
    })
    return () => {
      active = false
    }
  }, [role, userScore, initialCohort])

  if (!cohort) return null

  if (cohort.forming) {
    return (
      <section className="rounded-xl border border-dark-border bg-dark-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-4 w-4 text-linkedin" />
          <h3 className="text-sm font-semibold text-dark-textPri">Where you stand</h3>
        </div>
        <p className="text-sm text-dark-textMuted">
          Your cohort is forming — come back next month for peer benchmarks.
        </p>
      </section>
    )
  }

  const topPct = 100 - cohort.user_percentile
  const delta = cohort.percentile_delta_30d

  return (
    <section className="rounded-xl border border-dark-border bg-dark-card p-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-linkedin" />
          <span className="text-sm font-semibold text-dark-textPri">
            Top {topPct}% among {cohort.cohort_name}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-dark-textMuted">
          {delta != null && delta !== 0 && (
            <span className={delta > 0 ? 'text-green-400' : 'text-amber-400'}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} this month
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-dark-textMuted">Among {cohort.cohort_size} {cohort.cohort_name} assessed:</p>
          <CohortDistributionChart distribution={cohort.distribution} userPercentile={cohort.user_percentile} />
        </div>
      )}
    </section>
  )
}
