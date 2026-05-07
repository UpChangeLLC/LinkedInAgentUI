/** Career Analyst / Mentor chat API client (same auth as MCP). */

function mcpAuthHeaders(): Record<string, string> {
    const env = (import.meta as any).env || {}
    const key = (env.VITE_MCP_API_KEY as string | undefined)?.trim()
    if (!key) return {}
    return { Authorization: `Bearer ${key}` }
}

function baseUrl(): string {
    const env = (import.meta as any).env || {}
    return String((env.VITE_MCP_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
}

function jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...mcpAuthHeaders() }
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
        headers: { ...mcpAuthHeaders() },
        signal: timeoutSignal(CHAT_TIMEOUT_MS),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
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
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
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
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
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
