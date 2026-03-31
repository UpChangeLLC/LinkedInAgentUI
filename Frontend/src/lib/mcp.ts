// Lightweight client for the MCP HTTP adapter
export type McpRunPayload = {
    linkedin_url?: string
    resume_text?: string
}

export async function mcpRun(payload: McpRunPayload) {
    // Vite exposes env via import.meta.env; cast to any for TS friendliness here
    const env = (import.meta as any).env || {}
    // Empty / unset = same origin (Docker + reverse proxy: API served from same host as static)
    const baseUrl = (env.VITE_MCP_BASE_URL as string | undefined) ?? ''
    const apiKey = env.VITE_MCP_API_KEY as string | undefined
    const res = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/mcp/run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
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
    return res.json() as Promise<{
        status: 'ok'
        data_source: string
        trace: Array<{ step: string; success: boolean; duration_ms: number; info: string }>
        result: Record<string, any>
    }>
}

