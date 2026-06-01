// Lightweight client for the MCP HTTP adapter
import { AgentRunResponseSchema, type AgentRunResponse } from './schemas'
import { getStoredSignupSession } from './signup'

export interface UserContext {
    concern: string
    ai_involvement: number
    industry: string
    years_in_role: number
}

export type McpRunPayload = {
    linkedin_url?: string
    resume_text?: string
    user_context?: UserContext | null
    survey_responses?: Record<string, unknown> | null
    linkedin_run_id?: string | null
}

/** Raised when the backend rejects a run because the 30-day free re-run gate is active. */
export class RerunLockedError extends Error {
    nextRerunAt: string | null
    constructor(nextRerunAt: string | null) {
        super('RERUN_LOCKED')
        this.name = 'RerunLockedError'
        this.nextRerunAt = nextRerunAt
    }
}

/** Raised when the backend requires a session (hard auth gate) and none was sent. */
export class AuthRequiredError extends Error {
    constructor() {
        super('AUTH_REQUIRED')
        this.name = 'AuthRequiredError'
    }
}

function mcpAuthHeaders(): Record<string, string> {
    const env = (import.meta as any).env || {}
    const key = (env.VITE_MCP_API_KEY as string | undefined)?.trim()
    if (!key) return {}
    return { Authorization: `Bearer ${key}` }
}

/** Per-user identity for the hard auth gate. Distinct from the static
 * MCP_API_KEY carried in Authorization — the backend reads X-Session-Token. */
function sessionHeaders(): Record<string, string> {
    const token = getStoredSignupSession()?.accessToken?.trim()
    return token ? { 'X-Session-Token': token } : {}
}

function jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...mcpAuthHeaders(), ...sessionHeaders() }
}

/** Map a non-OK run response to a typed error (429 RERUN_LOCKED / 401 AUTH_REQUIRED). */
async function raiseRunError(res: Response): Promise<never> {
    let body: any = null
    const text = await res.text().catch(() => '')
    try { body = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    const code = body?.detail?.code ?? body?.code
    if (res.status === 429 || code === 'RERUN_LOCKED') {
        throw new RerunLockedError(body?.detail?.next_rerun_at ?? body?.next_rerun_at ?? null)
    }
    if (res.status === 401 || code === 'AUTH_REQUIRED') {
        throw new AuthRequiredError()
    }
    throw new Error(text || `HTTP ${res.status}`)
}

/** AbortSignal.timeout is missing on Safari <16.4 — without this, fetch throws before any request (mobile shows "Load failed"). */
function timeoutSignal(ms: number): AbortSignal {
    const AT = AbortSignal as typeof AbortSignal & { timeout?: (n: number) => AbortSignal }
    if (typeof AT.timeout === 'function') {
        return AT.timeout(ms)
    }
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), ms)
    c.signal.addEventListener('abort', () => clearTimeout(t), { once: true })
    return c.signal
}

/** All iOS browsers use WebKit; long-lived fetch streams for SSE are unreliable — use POST /mcp/run only. */
function preferPostOnlyPipeline(): boolean {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isIPadDesktopUA =
        navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1
    return /iPhone|iPad|iPod/.test(ua) || isIPadDesktopUA
}

const RUN_TIMEOUT_MS = 5 * 60 * 1000   // 5 minutes for full pipeline
const PREVIEW_TIMEOUT_MS = 30 * 1000    // 30 seconds for preview
const SSE_TIMEOUT_MS = 6 * 60 * 1000    // 6 minutes for SSE stream

export async function mcpRun(payload: McpRunPayload): Promise<AgentRunResponse> {
    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/mcp/run`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
            linkedin_url: payload.linkedin_url ?? '',
            resume_text: payload.resume_text ?? '',
            ...(payload.user_context ? { user_context: payload.user_context } : {}),
            ...(payload.survey_responses ? { survey_responses: payload.survey_responses } : {}),
            ...(payload.linkedin_run_id ? { linkedin_run_id: payload.linkedin_run_id } : {}),
        }),
        signal: timeoutSignal(RUN_TIMEOUT_MS),
    })
    if (!res.ok) {
        await raiseRunError(res)
    }
    const json = await res.json()
    return AgentRunResponseSchema.parse(json)
}

// ── Profile preview client ──────────────────────────────────────────────

export interface ProfilePreview {
    name: string
    title: string
    company: string
    location: string
    summary: string
    years_experience: number
    skills_count: number
    skills: string[]
    certifications_count: number
    education_count: number
    experience_count: number
    completeness_score: number
    missing_fields: string[]
    data_source: string
}

export async function previewProfile(payload: McpRunPayload): Promise<ProfilePreview> {
    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/mcp/preview`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
            linkedin_url: payload.linkedin_url ?? '',
            resume_text: payload.resume_text ?? '',
        }),
        signal: timeoutSignal(PREVIEW_TIMEOUT_MS),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        let message = `HTTP ${res.status}`
        try {
            const parsed = JSON.parse(text)
            message = parsed?.detail?.message || parsed?.detail || message
        } catch { /* use default */ }
        throw new Error(message)
    }
    const json = await res.json()
    if (json.status !== 'ok' || !json.preview) {
        throw new Error('Invalid preview response')
    }
    return json.preview as ProfilePreview
}

// ── SSE streaming client ────────────────────────────────────────────────

export interface PipelineEvent {
    event_type: string
    node: string
    status: string
    duration_ms: number
    info: string
    data_points: number
    progress: number
    partial_result: Record<string, any>
}

/**
 * Stream pipeline execution via SSE. Calls onEvent for each pipeline event
 * and resolves with the final AgentRunResponse on completion.
 * Falls back to regular mcpRun() if SSE connection fails.
 */
export async function streamAnalysis(
    payload: McpRunPayload,
    onEvent: (event: PipelineEvent) => void,
): Promise<AgentRunResponse> {
    if (preferPostOnlyPipeline()) {
        return mcpRun(payload)
    }

    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const url = `${String(baseUrl).replace(/\/+$/, '')}/mcp/run/stream`

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({
                linkedin_url: payload.linkedin_url ?? '',
                resume_text: payload.resume_text ?? '',
                ...(payload.user_context ? { user_context: payload.user_context } : {}),
                ...(payload.survey_responses ? { survey_responses: payload.survey_responses } : {}),
                ...(payload.linkedin_run_id ? { linkedin_run_id: payload.linkedin_run_id } : {}),
            }),
            signal: timeoutSignal(SSE_TIMEOUT_MS),
        })

        if (!res.ok) {
            // Surface auth/re-run gate errors as typed errors (don't fall back to a retry).
            if (res.status === 401 || res.status === 429) {
                await raiseRunError(res)
            }
            throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult: AgentRunResponse | null = null

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Parse SSE lines
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const jsonStr = line.slice(5).trim()
                    if (!jsonStr) continue
                    try {
                        const event: PipelineEvent = JSON.parse(jsonStr)
                        onEvent(event)

                        // Extract final result from pipeline_complete event
                        if (event.event_type === 'pipeline_complete' && event.partial_result?.result) {
                            finalResult = AgentRunResponseSchema.parse(event.partial_result)
                        }
                        // Surface pipeline errors
                        if (event.event_type === 'pipeline_error') {
                            throw new Error(event.info || 'Pipeline failed')
                        }
                    } catch (e: any) {
                        if (e?.message?.includes('Pipeline failed') || e?.message?.includes('Pipeline')) {
                            throw e
                        }
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        }

        if (finalResult) return finalResult

        // If we got here without a result, fall back
        throw new Error('SSE stream ended without result')
    } catch (err: any) {
        // Never retry auth / re-run gate rejections — surface them as-is.
        if (err instanceof RerunLockedError || err instanceof AuthRequiredError) throw err
        // Fallback to polling if SSE fails to connect
        if (err?.message?.includes('Pipeline')) throw err
        console.warn('SSE stream failed, falling back to polling:', err?.message)
        return mcpRun(payload)
    }
}

// ── Cached result lookup ───────────────────────────────────────────────

export interface CachedResultResponse {
    status: 'hit' | 'miss'
    result?: Record<string, any>
    created_at?: string
}

export async function fetchCachedResult(urlHash: string): Promise<CachedResultResponse> {
    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    try {
        const res = await fetch(
            `${String(baseUrl).replace(/\/+$/, '')}/api/results/${urlHash}`,
            { signal: timeoutSignal(10_000), headers: { ...mcpAuthHeaders() } },
        )
        if (!res.ok) return { status: 'miss' }
        return await res.json()
    } catch {
        return { status: 'miss' }
    }
}
