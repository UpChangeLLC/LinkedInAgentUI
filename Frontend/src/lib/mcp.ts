// Lightweight client for the MCP HTTP adapter
import { AgentRunResponseSchema, type AgentRunResponse } from './schemas'

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
}

export async function mcpRun(payload: McpRunPayload): Promise<AgentRunResponse> {
    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/mcp/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            linkedin_url: payload.linkedin_url ?? '',
            resume_text: payload.resume_text ?? '',
            ...(payload.user_context ? { user_context: payload.user_context } : {}),
        })
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            linkedin_url: payload.linkedin_url ?? '',
            resume_text: payload.resume_text ?? '',
        }),
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
    const env = (import.meta as any).env || {}
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const url = `${String(baseUrl).replace(/\/+$/, '')}/mcp/run/stream`

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                linkedin_url: payload.linkedin_url ?? '',
                resume_text: payload.resume_text ?? '',
                ...(payload.user_context ? { user_context: payload.user_context } : {}),
            }),
        })

        if (!res.ok) {
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
        // Fallback to polling if SSE fails to connect
        if (err?.message?.includes('Pipeline')) throw err
        console.warn('SSE stream failed, falling back to polling:', err?.message)
        return mcpRun(payload)
    }
}
