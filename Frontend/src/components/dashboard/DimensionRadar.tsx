import { lazy, Suspense } from 'react'

export interface DimensionRadarRow {
  dimension: string
  score: number
}

// Recharts is heavy (~150KB gzip); load it only when the radar actually renders.
const DimensionRadarChart = lazy(() =>
  import('./DimensionRadarChart').then((m) => ({ default: m.DimensionRadarChart }))
)

/** Read-only radar of the 8 resilience dimensions (0–10). The accessible
 * wrapper renders immediately; the chart itself streams in lazily. */
export function DimensionRadar({ data }: { data: DimensionRadarRow[] }) {
  return (
    <div
      role="img"
      aria-label="Radar chart of your 8 resilience dimensions, each scored 0 to 10"
      className="w-full h-72"
    >
      <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-surface-off" />}>
        <DimensionRadarChart data={data} />
      </Suspense>
    </div>
  )
}
