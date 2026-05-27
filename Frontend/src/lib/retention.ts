// Retention types + helpers (Workstream D).

export interface TrajectoryEntry {
  run_id: string | null
  computed_at: string
  resilience_score: number | null
  readiness_score: number | null
  delta_from_previous: number | null
  top_change_dim: string | null
}

export interface TrajectoryResponse {
  history: TrajectoryEntry[]
  next_rerun_at: string | null
}

function humanizeDim(dim: string): string {
  return dim.replace(/_/g, ' ')
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'long' })
}

/** One-line trajectory summary, or null when there aren't enough data points. */
export function trajectoryCaption(history: TrajectoryEntry[]): string | null {
  if (!history || history.length < 2) return null
  const first = history[0]
  const last = history[history.length - 1]
  if (first.resilience_score == null || last.resilience_score == null) return null

  const total = Math.round(last.resilience_score - first.resilience_score)
  const sign = total >= 0 ? '+' : ''
  const since = monthLabel(first.computed_at)
  const dim = last.top_change_dim

  let caption = `${sign}${total} points`
  if (since) caption += ` since ${since}`
  if (dim) caption += `. Mostly from ${humanizeDim(dim)}`
  caption += '.'
  return caption
}

/** Fetch the score trajectory for a profile by url hash. */
export async function fetchTrajectory(urlHash: string): Promise<TrajectoryResponse> {
  const env = (import.meta as any).env || {}
  const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
  try {
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/api/history/${urlHash}/trajectory`)
    if (!res.ok) return { history: [], next_rerun_at: null }
    return (await res.json()) as TrajectoryResponse
  } catch {
    return { history: [], next_rerun_at: null }
  }
}
