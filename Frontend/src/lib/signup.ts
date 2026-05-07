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

function timeoutSignal(ms: number): AbortSignal {
    const AT = AbortSignal as typeof AbortSignal & { timeout?: (n: number) => AbortSignal }
    if (typeof AT.timeout === 'function') return AT.timeout(ms)
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), ms)
    c.signal.addEventListener('abort', () => clearTimeout(t), { once: true })
    return c.signal
}

export interface SignupPayload {
    full_name: string
    email: string
    password: string
    phone?: string
    company?: string
    role_title?: string
    linkedin_url?: string
    resume_provided: boolean
    resume_text_length: number
    github_url?: string
    website_url?: string
    user_context: Record<string, unknown>
    assessment_snapshot: Record<string, unknown>
    marketing_opt_in: boolean
}

export interface SignupResponse {
    status: 'ok' | 'error'
    persisted?: boolean
    signup_id?: string | null
    email?: string
    full_name?: string
    access_token?: string | null
    subscription_status?: 'trial' | 'active' | 'expired' | string
    subscription_active?: boolean
    subscription_expires_at?: string | null
    latest_assessment_result?: Record<string, any> | null
    latest_assessment_created_at?: string | null
    detail?: string
}

export type OAuthProvider = 'google' | 'linkedin'

export interface OAuthStartResponse {
    status: 'ok' | 'error'
    auth_url?: string
    detail?: string
}

export type OAuthCompletePayload = Omit<
    SignupPayload,
    'full_name' | 'email' | 'password' | 'phone' | 'company' | 'role_title' | 'marketing_opt_in'
> & {
    access_token: string
}

export interface StoredSignupSession {
    signupId: string | null
    email: string
    fullName: string
    accessToken: string
    subscriptionStatus: string
    subscriptionActive: boolean
    subscriptionExpiresAt: string | null
}

const SESSION_KEY = 'airs_signup_session'
const OAUTH_PENDING_KEY = 'airs_oauth_pending_signup'
export const PAYWALL_DEADLINE_KEY = 'airs_paywall_deadline_ms'

export function saveSignupSession(response: SignupResponse): StoredSignupSession | null {
    if (!response.access_token) return null
    const session: StoredSignupSession = {
        signupId: response.signup_id || null,
        email: response.email || '',
        fullName: response.full_name || '',
        accessToken: response.access_token,
        subscriptionStatus: response.subscription_status || 'trial',
        subscriptionActive: Boolean(response.subscription_active),
        subscriptionExpiresAt: response.subscription_expires_at || null,
    }
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
        /* ignore */
    }
    return session
}

export function getStoredSignupSession(): StoredSignupSession | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as StoredSignupSession
        return parsed?.accessToken ? parsed : null
    } catch {
        return null
    }
}

export function clearStoredSignupSession(): void {
    try {
        localStorage.removeItem(SESSION_KEY)
        localStorage.removeItem(PAYWALL_DEADLINE_KEY)
    } catch {
        /* ignore */
    }
}

export async function submitSignup(payload: SignupPayload): Promise<SignupResponse> {
    const res = await fetch(`${baseUrl()}/api/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...mcpAuthHeaders(),
        },
        body: JSON.stringify(payload),
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as SignupResponse
    if (!res.ok || json.status === 'error') {
        throw new Error(json.detail || `Signup failed (HTTP ${res.status})`)
    }
    return json
}

export async function startOAuth(provider: OAuthProvider): Promise<string> {
    const res = await fetch(`${baseUrl()}/api/signup/oauth/start/${provider}`, {
        method: 'GET',
        headers: {
            ...mcpAuthHeaders(),
        },
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as OAuthStartResponse
    if (!res.ok || json.status === 'error' || !json.auth_url) {
        throw new Error(json.detail || `${provider} sign-in is not available.`)
    }
    return json.auth_url
}

export async function completeOAuthSignup(payload: OAuthCompletePayload): Promise<SignupResponse> {
    const res = await fetch(`${baseUrl()}/api/signup/oauth/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...mcpAuthHeaders(),
        },
        body: JSON.stringify(payload),
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as SignupResponse
    if (!res.ok || json.status === 'error') {
        throw new Error(json.detail || `OAuth signup completion failed (HTTP ${res.status})`)
    }
    return json
}

export async function saveSignupAssessment(payload: OAuthCompletePayload): Promise<SignupResponse> {
    const res = await fetch(`${baseUrl()}/api/signup/assessment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...mcpAuthHeaders(),
        },
        body: JSON.stringify(payload),
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as SignupResponse
    if (!res.ok || json.status === 'error') {
        throw new Error(json.detail || `Assessment save failed (HTTP ${res.status})`)
    }
    return json
}

export function consumeOAuthRedirect(): SignupResponse | null {
    const hash = window.location.hash || ''
    const match = hash.match(/(?:^#|&)auth=([^&]+)/)
    if (!match) return null
    try {
        const encoded = decodeURIComponent(match[1])
        const padded = encoded.padEnd(encoded.length + ((4 - encoded.length % 4) % 4), '=')
        const parsed = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as SignupResponse
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
        return parsed?.access_token ? parsed : null
    } catch {
        return null
    }
}

export function savePendingOAuthSignup(value: unknown): void {
    try {
        localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(value))
    } catch {
        /* ignore */
    }
}

export function consumePendingOAuthSignup<T>(): T | null {
    try {
        const raw = localStorage.getItem(OAUTH_PENDING_KEY)
        localStorage.removeItem(OAUTH_PENDING_KEY)
        return raw ? (JSON.parse(raw) as T) : null
    } catch {
        return null
    }
}

export async function restoreSignupSession(args: {
    email?: string
    password?: string
    accessToken?: string
}): Promise<SignupResponse> {
    const res = await fetch(`${baseUrl()}/api/signup/session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...mcpAuthHeaders(),
        },
        body: JSON.stringify({
            ...(args.email?.trim() ? { email: args.email.trim() } : {}),
            ...(args.password ? { password: args.password } : {}),
            ...(args.accessToken?.trim() ? { access_token: args.accessToken.trim() } : {}),
        }),
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as SignupResponse
    if (!res.ok || json.status === 'error') {
        throw new Error(json.detail || `Session restore failed (HTTP ${res.status})`)
    }
    return json
}

export async function activateDummySubscription(accessToken: string, months = 1): Promise<SignupResponse> {
    const res = await fetch(`${baseUrl()}/api/signup/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...mcpAuthHeaders(),
        },
        body: JSON.stringify({ access_token: accessToken, months }),
        signal: timeoutSignal(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as SignupResponse
    if (!res.ok || json.status === 'error') {
        throw new Error(json.detail || `Subscription failed (HTTP ${res.status})`)
    }
    return json
}

export function buildSignupPayload(
    details: {
        fullName: string
        email: string
        password: string
        phone?: string
        company?: string
        roleTitle?: string
        marketingOptIn: boolean
    },
    formData: Record<string, any>,
    resultsBackend: Record<string, any> | null | undefined,
    results: Record<string, any>
): SignupPayload {
    const backendResult = resultsBackend?.result || {}
    const summary = backendResult.executive_summary || backendResult.summary || ''
    const score = backendResult.profile_score ?? backendResult.score ?? results.score
    const riskBand = backendResult.risk_band ?? results.riskBand
    const hasBackendResult = Boolean(resultsBackend?.result)

    return {
        full_name: details.fullName.trim(),
        email: details.email.trim(),
        password: details.password,
        ...(details.phone?.trim() ? { phone: details.phone.trim() } : {}),
        ...(details.company?.trim() ? { company: details.company.trim() } : {}),
        ...(details.roleTitle?.trim() ? { role_title: details.roleTitle.trim() } : {}),
        linkedin_url: formData?.linkedinUrl || formData?.linkedin_url || '',
        resume_provided: Boolean(formData?.resumeText || formData?.resume_text),
        resume_text_length: String(formData?.resumeText || formData?.resume_text || '').length,
        ...(formData?.githubUrl || formData?.github_url ? { github_url: formData?.githubUrl || formData?.github_url } : {}),
        ...(formData?.websiteUrl || formData?.website_url ? { website_url: formData?.websiteUrl || formData?.website_url } : {}),
        user_context: formData?.userContext || formData?.user_context || {},
        assessment_snapshot: hasBackendResult
            ? {
                score,
                risk_band: riskBand,
                executive_summary: summary,
                title: results?.personalProfile?.title || '',
                industry: results?.personalProfile?.industry || '',
                data_source: backendResult?.data_source || '',
            }
            : {},
        marketing_opt_in: details.marketingOptIn,
    }
}

export function buildOAuthCompletePayload(
    accessToken: string,
    formData: Record<string, any>,
    resultsBackend: Record<string, any> | null | undefined,
    results: Record<string, any>
): OAuthCompletePayload {
    const payload = buildSignupPayload(
        {
            fullName: 'OAuth User',
            email: 'oauth@example.com',
            password: 'OAuthPassword1',
            marketingOptIn: false,
        },
        formData,
        resultsBackend,
        results
    )
    const { full_name, email, password, phone, company, role_title, marketing_opt_in, ...rest } = payload
    void full_name
    void email
    void password
    void phone
    void company
    void role_title
    void marketing_opt_in
    return {
        ...rest,
        assessment_snapshot: (resultsBackend?.result as Record<string, any> | undefined) || results || {},
        access_token: accessToken,
    }
}
