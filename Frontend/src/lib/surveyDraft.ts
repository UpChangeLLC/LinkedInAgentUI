// Survey draft persistence (spec 01 §7.2). Debounced save + 7-day TTL,
// keyed to the in-flight linkedin_run_id so a stale draft is never restored.
import type { SurveyResponse } from './survey'

const KEY = 'upchange.survey.draft'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface DraftEnvelope {
  linkedin_run_id: string
  timestamp: number
  responses: Partial<SurveyResponse>
}

export function saveDraft(linkedinRunId: string, partial: Partial<SurveyResponse>): void {
  try {
    const existing = loadDraft(linkedinRunId)
    const merged: DraftEnvelope = {
      linkedin_run_id: linkedinRunId,
      timestamp: Date.now(),
      responses: { ...(existing?.responses ?? {}), ...partial },
    }
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    /* storage unavailable (private mode) — drafts are best-effort */
  }
}

export function loadDraft(linkedinRunId: string): { responses: Partial<SurveyResponse> } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftEnvelope
    if (parsed.linkedin_run_id !== linkedinRunId) return null // stale run
    if (Date.now() - parsed.timestamp > TTL_MS) return null // expired
    return { responses: parsed.responses ?? {} }
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
