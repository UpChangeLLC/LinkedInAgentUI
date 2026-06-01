import type { Page } from '@playwright/test'

/**
 * Deterministic backend stubs for the onboarding E2E. Every `/mcp/*` and
 * `/api/*` call the onboarding path makes is intercepted and fulfilled with a
 * fixed fixture, so the flow runs with no real backend / Apify / LLM.
 */

const PREVIEW = {
  name: 'Ada Lovelace',
  title: 'Staff Engineer',
  company: 'Analytical Engines',
  location: 'London',
  summary: 'Builds AI-assisted developer tooling.',
  years_experience: 9,
  skills_count: 12,
  skills: ['Python', 'ML', 'SQL', 'Leadership'],
  certifications_count: 2,
  education_count: 1,
  experience_count: 4,
  completeness_score: 0.82,
  missing_fields: [],
  data_source: 'linkedin',
}

const dim = (score: number) => ({ score, confidence: 'high', rationale: 'mock', evidence: ['mock'] })

/** A valid AgentRunResponse (matches AgentRunResponseSchema). */
export const AGENT_RESPONSE = {
  status: 'ok',
  data_source: 'linkedin',
  trace: [{ step: 'parse', success: true, duration_ms: 10, info: 'parsed profile' }],
  result: {
    score: 74,
    profile_score: 74,
    risk_band: 'Moderate Risk',
    executive_summary: 'A resilient, AI-forward engineering profile.',
    data_source: 'linkedin',
    dimension_scores: {
      ai_fluency: dim(5),
      technical_proximity: dim(5),
      governance_awareness: dim(4),
      learning_velocity: dim(5),
      leadership_readiness: dim(4),
      network_relevance: dim(3),
      automation_exposure: dim(2),
      execution_credibility: dim(5),
    },
    score_breakdown_list: [
      { name: 'AI Fluency', weight: 'High', value: 90, explanation: '', personal_context: '' },
      { name: 'Technical Proximity', weight: 'High', value: 88, explanation: '', personal_context: '' },
    ],
  },
}

const SIGNUP_RESPONSE = {
  status: 'ok',
  persisted: true,
  signup_id: 'e2e-signup-1',
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  access_token: 'e2e-access-token',
  subscription_status: 'trial',
  subscription_active: false,
  subscription_expires_at: null,
  latest_assessment_result: null,
  latest_assessment_created_at: null,
}

/** SSE body that streams one progress event then `pipeline_complete`. */
const SSE_BODY = [
  `data: ${JSON.stringify({ event_type: 'node_complete', node: 'parse', status: 'ok', duration_ms: 10, info: 'parsing', data_points: 1, progress: 50, partial_result: {} })}`,
  '',
  `data: ${JSON.stringify({ event_type: 'pipeline_complete', node: 'done', status: 'ok', duration_ms: 20, info: 'done', data_points: 2, progress: 100, partial_result: AGENT_RESPONSE })}`,
  '',
  '',
].join('\n')

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

export async function mockOnboardingBackend(page: Page): Promise<void> {
  // Broadest first; later registrations take priority in Playwright.
  await page.route('**/api/**', (route) => route.fulfill(json({})))

  await page.route('**/mcp/preview', (route) => route.fulfill(json({ status: 'ok', preview: PREVIEW })))
  await page.route('**/mcp/run', (route) => route.fulfill(json(AGENT_RESPONSE)))
  await page.route('**/mcp/run/stream', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_BODY }))

  await page.route('**/api/results/**', (route) => route.fulfill(json({ status: 'miss' })))
  await page.route('**/api/signup**', (route) => route.fulfill(json(SIGNUP_RESPONSE)))
}
