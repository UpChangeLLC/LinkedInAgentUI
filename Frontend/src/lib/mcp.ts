// Lightweight client for the MCP HTTP adapter
import { AgentRunResponseSchema, type AgentRunResponse } from './schemas'

export type McpRunPayload = {
    linkedin_url?: string
    resume_text?: string
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
            resume_text: payload.resume_text ?? ''
        })
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
    }
    const json = await res.json()
    return AgentRunResponseSchema.parse(json)
}
