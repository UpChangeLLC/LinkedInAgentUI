// Retention types + helpers (Workstream D).
import { getStoredSignupSession } from './signup'

export interface NotificationPreferences {
  score_updates: boolean
  reassessment_reminders: boolean
  product_tips: boolean
}

function sessionHeaders(): Record<string, string> {
  const token = getStoredSignupSession()?.accessToken?.trim()
  return token ? { 'X-Session-Token': token } : {}
}

function apiBase(): string {
  const env = (import.meta as any).env || {}
  return String((env.VITE_MCP_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
}

const DEFAULT_PREFS: NotificationPreferences = {
  score_updates: true,
  reassessment_reminders: true,
  product_tips: true,
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const res = await fetch(`${apiBase()}/api/notifications/preferences`, { headers: { ...sessionHeaders() } })
    if (!res.ok) return { ...DEFAULT_PREFS }
    return (await res.json()) as NotificationPreferences
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export async function updateNotificationPreferences(patch: Partial<NotificationPreferences>): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch {
    return false
  }
}

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

export interface CohortResponse {
  cohort_name: string
  cohort_size: number
  user_percentile: number
  percentile_delta_30d: number | null
  distribution: Array<{ bucket: number; count: number }>
  forming: boolean
}

/** Fetch peer-cohort standing for a role + the user's score. */
export async function fetchCohort(role: string, userScore: number): Promise<CohortResponse> {
  const env = (import.meta as any).env || {}
  const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
  const qs = new URLSearchParams({ role: role || '', user_score: String(userScore || 0) })
  const fallback: CohortResponse = {
    cohort_name: role || 'your role',
    cohort_size: 0,
    user_percentile: 0,
    percentile_delta_30d: null,
    distribution: [],
    forming: true,
  }
  try {
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/api/community-insights/cohort?${qs}`)
    if (!res.ok) return fallback
    return (await res.json()) as CohortResponse
  } catch {
    return fallback
  }
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
