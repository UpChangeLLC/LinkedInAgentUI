/** Career Analyst / Mentor chat API client (same auth as MCP). */

import { getStoredSignupSession } from './signup'

function mcpAuthHeaders(): Record<string, string> {
    const env = (import.meta as any).env || {}
    const key = (env.VITE_MCP_API_KEY as string | undefined)?.trim()
    if (!key) return {}
    return { Authorization: `Bearer ${key}` }
}

/** Per-user session token so the backend can bind chat sessions to the account
 *  (auth_deps.optional_session reads the X-Session-Token header). */
function sessionAuthHeaders(): Record<string, string> {
    try {
        const token = getStoredSignupSession()?.accessToken?.trim()
        return token ? { 'X-Session-Token': token } : {}
    } catch {
        return {}
    }
}

function authHeaders(): Record<string, string> {
    return { ...mcpAuthHeaders(), ...sessionAuthHeaders() }
}

function baseUrl(): string {
    const env = (import.meta as any).env || {}
    return String((env.VITE_MCP_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
}

function jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...authHeaders() }
}

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

const CHAT_TIMEOUT_MS = 120_000

/** Error carrying the HTTP status + backend `detail.code` so the UI can tell a
 *  paywall (402 premium_required) apart from a generic failure. */
export class ChatApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
        super(message)
        this.name = 'ChatApiError'
        this.status = status
        this.code = code
    }
    get premiumRequired(): boolean {
        return this.status === 402 || this.code === 'premium_required'
    }
}

async function raiseForStatus(res: Response): Promise<never> {
    const text = await res.text().catch(() => '')
    let code: string | undefined
    try {
        const parsed = JSON.parse(text)
        code = parsed?.detail?.code ?? parsed?.code
    } catch {
        /* non-JSON body */
    }
    throw new ChatApiError(text || `HTTP ${res.status}`, res.status, code)
}

export type CareerChatTurn = { role: 'user' | 'assistant'; content: string }

export type CareerChatMessageResponse = {
    reply: string
    history: CareerChatTurn[]
}

const SID_KEY = 'airs_career_chat_session_id'

export function getOrCreateCareerChatSessionId(): string {
    try {
        let sid = localStorage.getItem(SID_KEY)?.trim()
        if (!sid || sid.length < 8) {
            sid =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID().replace(/-/g, '')
                    : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
            localStorage.setItem(SID_KEY, sid)
        }
        return sid
    } catch {
        return `sess_${Date.now().toString(36)}`
    }
}

export function rotateCareerChatSessionId(): string {
    const sid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().replace(/-/g, '')
            : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    try {
        localStorage.setItem(SID_KEY, sid)
    } catch {
        /* ignore */
    }
    return sid
}

export async function fetchCareerChatHistory(sessionId: string): Promise<CareerChatTurn[]> {
    const u = `${baseUrl()}/api/career-chat/history?session_id=${encodeURIComponent(sessionId)}`
    const res = await fetch(u, {
        method: 'GET',
        headers: { ...authHeaders() },
        signal: timeoutSignal(CHAT_TIMEOUT_MS),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
    const json = (await res.json()) as CareerChatMessageResponse
    return json.history || []
}

export async function postCareerChatMessage(
    sessionId: string,
    message: string,
    assessmentContext?: string
): Promise<CareerChatMessageResponse> {
    const res = await fetch(`${baseUrl()}/api/career-chat/message`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
            session_id: sessionId,
            message,
            ...(assessmentContext?.trim() ? { assessment_context: assessmentContext.trim() } : {}),
        }),
        signal: timeoutSignal(CHAT_TIMEOUT_MS),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
    return (await res.json()) as CareerChatMessageResponse
}

export async function resetCareerChatSession(sessionId: string): Promise<void> {
    const res = await fetch(`${baseUrl()}/api/career-chat/reset`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
        signal: timeoutSignal(30_000),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
}

// ── Per-user saved sessions (Pro) ───────────────────────────────────────────

export type CareerChatSessionSummary = {
    session_id: string
    title: string
    last_message_at?: string | null
}

const LAST_ACTIVE_KEY = 'airs_career_chat_last_active_sid'

export function getLastActiveSessionId(): string | null {
    try {
        return localStorage.getItem(LAST_ACTIVE_KEY)?.trim() || null
    } catch {
        return null
    }
}

export function setLastActiveSessionId(sid: string): void {
    try {
        localStorage.setItem(LAST_ACTIVE_KEY, sid)
    } catch {
        /* ignore */
    }
}

export async function listCareerChatSessions(): Promise<CareerChatSessionSummary[]> {
    const res = await fetch(`${baseUrl()}/api/career-chat/sessions`, {
        method: 'GET',
        headers: { ...authHeaders() },
        signal: timeoutSignal(30_000),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
    return (await res.json()) as CareerChatSessionSummary[]
}

export async function createCareerChatSession(): Promise<{ session_id: string; title: string }> {
    const res = await fetch(`${baseUrl()}/api/career-chat/sessions`, {
        method: 'POST',
        headers: jsonHeaders(),
        signal: timeoutSignal(30_000),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
    return (await res.json()) as { session_id: string; title: string }
}

export async function renameCareerChatSession(sid: string, title: string): Promise<void> {
    const res = await fetch(`${baseUrl()}/api/career-chat/sessions/${encodeURIComponent(sid)}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ title }),
        signal: timeoutSignal(30_000),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
}

export async function deleteCareerChatSession(sid: string): Promise<void> {
    const res = await fetch(`${baseUrl()}/api/career-chat/sessions/${encodeURIComponent(sid)}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
        signal: timeoutSignal(30_000),
    })
    if (!res.ok) {
        await raiseForStatus(res)
    }
}

/** Compact text for mentor grounding from dashboard + optional backend payload. */
export function buildCareerAssessmentContext(
    results: Record<string, unknown>,
    resultsBackend: Record<string, unknown> | null | undefined,
    formData: Record<string, unknown> | null | undefined
): string {
    const lines: string[] = []
    const br = resultsBackend?.result as Record<string, unknown> | undefined
    const exec = (br?.executive_summary || br?.summary) as string | undefined
    if (exec?.trim()) lines.push(`Executive summary:\n${exec.trim()}`)

    const name = (results.personalProfile as Record<string, unknown> | undefined)?.name
    const title = (results.personalProfile as Record<string, unknown> | undefined)?.title
    const industry = (results.personalProfile as Record<string, unknown> | undefined)?.industry
    if (name || title || industry) {
        lines.push(`Profile: ${[name, title, industry].filter(Boolean).join(' · ')}`)
    }
    if (typeof results.score === 'number') lines.push(`AI Resilience score (dashboard): ${results.score}`)
    if (typeof results.riskBand === 'string' && results.riskBand) lines.push(`Risk band: ${results.riskBand}`)

    const strengths = (results.strengths as string[] | undefined)?.slice(0, 5)
    const gaps = (results.gaps as string[] | undefined)?.slice(0, 5)
    if (strengths?.length) lines.push(`Strengths: ${strengths.join('; ')}`)
    if (gaps?.length) lines.push(`Gaps: ${gaps.join('; ')}`)

    const li = (formData?.linkedinUrl || formData?.linkedin_url) as string | undefined
    if (li) lines.push(`LinkedIn (reference): ${li}`)

    const text = lines.join('\n\n')
    return text.length > 15000 ? `${text.slice(0, 14997)}...` : text
}
