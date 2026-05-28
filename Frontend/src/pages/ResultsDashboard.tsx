import React, { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowRight, BarChart3, Clock, History, LayoutGrid, Lock, MessageSquare,
  Share2, Sparkles, Target, TrendingUp, User, X,
} from 'lucide-react'
import { MockResults } from '../data/mockResults'
import { ScoreReveal } from '../components/dashboard/ScoreReveal'
import { ScoreTrajectorySection } from '../components/dashboard/ScoreTrajectorySection'
import { CohortMovementSection } from '../components/dashboard/CohortMovementSection'

interface ResultsDashboardProps {
  results: MockResults
  formData: any
  onBackToHome?: () => void
  onSubscriptions?: () => void
  accountName?: string
  onDashboard?: () => void
  onRecalculate?: () => void
  onLogout?: () => void
  onSettings?: () => void
  onOpenCareerMentor?: () => void
  seedAssessmentContext?: string
  subscriptionActive?: boolean
  paywallLocked?: boolean
  showScoreReveal?: boolean
  onScoreRevealComplete?: () => void
  subscriptionSubmitting?: boolean
  onActivateSubscription?: (planId?: string, paymentMethod?: Record<string, unknown>) => void
}

/** Canonical 8 dimensions in mock order. */
const DIMS: { key: string; label: string; inverse?: boolean }[] = [
  { key: 'AI Fluency', label: 'AI Fluency' },
  { key: 'Automation Exposure', label: 'Automation Exposure', inverse: true },
  { key: 'Learning Velocity', label: 'Learning Velocity' },
  { key: 'Technical Proximity', label: 'Technical Proximity' },
  { key: 'Execution Credibility', label: 'Execution Credibility' },
  { key: 'Leadership Readiness', label: 'Leadership Readiness' },
  { key: 'Governance Awareness', label: 'Governance Awareness' },
  { key: 'Network Relevance', label: 'Network Relevance' },
]

function pickDim(factors: MockResults['scoreFactors'] | undefined, name: string): number {
  // Match the whole dim name (case-insensitive) to avoid first-token collisions.
  const target = name.toLowerCase()
  const f = (factors || []).find((x) => x.name.toLowerCase() === target)
    || (factors || []).find((x) => x.name.toLowerCase().includes(target))
  if (!f) return 0
  const v = typeof f.value === 'number' ? f.value : 0
  // Normalize any input scale (0–5, 0–10, or 0–100) into a 0–10 display value.
  const tenScale = v > 10 ? v / 10 : v
  return Math.max(0, Math.min(10, tenScale))
}

/** Mock-aligned free-tier dashboard (Career-AI/onboarding-flow-mock.html §7). */
export function ResultsDashboard({
  results, formData, onSubscriptions, accountName, onLogout, onRecalculate,
  subscriptionActive = false, showScoreReveal = false, onScoreRevealComplete,
}: ResultsDashboardProps) {
  const [upsellOpen, setUpsellOpen] = useState(false)
  const tier: 'free' | 'premium' = subscriptionActive ? 'premium' : 'free'
  const openUpsell = () => (onSubscriptions ? onSubscriptions() : setUpsellOpen(true))

  const score = results.score ?? 0
  const readiness = Math.max(0, Math.round(score - 12)) // best-effort placeholder until v1 ML
  const riskBand = results.riskBand || 'Moderate Risk'
  const cohortName = results.personalProfile?.title || 'your cohort'
  const displayName = accountName || results.personalProfile?.name || 'there'

  return (
    <>
      <AnimatePresence>
        {showScoreReveal && <ScoreReveal results={results} onComplete={onScoreRevealComplete ?? (() => {})} />}
      </AnimatePresence>

      <div className="min-h-screen bg-surface-off">
        <DashboardHeader
          accountName={displayName}
          tier={tier}
          onUpsell={openUpsell}
          onLogout={onLogout}
        />

        <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
          <Sidebar tier={tier} onUpsell={openUpsell} />

          <main className="space-y-6">
            <WelcomeStrip onRerun={onRecalculate} />

            <HeadlineScoresCard
              score={score}
              readiness={readiness}
              riskBand={riskBand}
              cohortName={cohortName}
            />

            <DimensionBreakdownCard factors={results.scoreFactors} tier={tier} onUpsell={openUpsell} />

            <SummaryParagraphCard
              name={displayName.split(/\s+/)[0]}
              score={score}
              cohortName={cohortName}
              factors={results.scoreFactors}
              backendResult={formData?.backend?.result}
            />

            <ScoreTrajectorySection urlHash={results.urlHash} tier={tier} onRerun={onRecalculate} />
            <CohortMovementSection role={results.personalProfile?.title} userScore={score} />

            {tier === 'free' && (
              <>
                <PersonalRoadmapTeaser onUnlock={openUpsell} />
                <div className="grid md:grid-cols-2 gap-6">
                  <MentorChatTeaser onUnlock={openUpsell} />
                  <LearningTeaser onUnlock={openUpsell} />
                </div>
              </>
            )}

            <ReassessCTA tier={tier} onUpsell={openUpsell} />
          </main>
        </div>
      </div>

      {upsellOpen && tier === 'free' && (
        <UpsellModal onClose={() => setUpsellOpen(false)} onSubscribe={onSubscriptions} />
      )}
    </>
  )
}

// ── Header ──────────────────────────────────────────────────────────────

function DashboardHeader({
  accountName, tier, onUpsell, onLogout,
}: { accountName: string; tier: 'free' | 'premium'; onUpsell: () => void; onLogout?: () => void }) {
  return (
    <header className="bg-white border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-linkedin flex items-center justify-center">
            <span className="text-white font-bold text-sm">u</span>
          </div>
          <span className="font-semibold text-[15px] text-gray-900">Upchange</span>
          <span className="text-gray-500 text-xs ml-2">Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {tier === 'free' && (
            <>
              <span className="text-gray-500 hidden md:inline">Free tier</span>
              <button
                onClick={onUpsell}
                className="bg-linkedin hover:bg-linkedin-dark text-white font-medium px-4 py-1.5 rounded-full text-xs inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Unlock Premium — $9/mo
              </button>
            </>
          )}
          <span className="text-sm text-gray-500 hidden md:inline">{accountName}</span>
          {onLogout && (
            <button onClick={onLogout} className="text-gray-500 hover:text-gray-900 text-xs">Log out</button>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────

function Sidebar({ tier, onUpsell }: { tier: 'free' | 'premium'; onUpsell: () => void }) {
  const item = (active: boolean, locked: boolean, icon: React.ReactNode, label: string, onClick?: () => void) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition ${
        active
          ? 'bg-linkedin/5 text-linkedin font-medium'
          : locked
            ? 'text-gray-500 hover:bg-surface-off'
            : 'text-gray-700 hover:bg-surface-off'
      }`}
    >
      {icon} {label}
    </button>
  )

  return (
    <aside className="hidden lg:block">
      <nav className="space-y-1">
        {item(true, false, <LayoutGrid className="w-4 h-4" />, 'Overview')}
        {item(false, false, <User className="w-4 h-4" />, 'Your score')}
        {item(false, false, <BarChart3 className="w-4 h-4" />, 'Dim breakdown')}

        <div className="my-3 border-t border-surface-border" />
        {tier === 'free' && (
          <div className="text-[10px] uppercase tracking-wider text-gray-300 px-3 mb-2">Premium</div>
        )}
        {[
          { icon: <Target className="w-4 h-4" />, label: 'Personal roadmap' },
          { icon: <Lock className="w-4 h-4" />, label: 'Action tracker' },
          { icon: <Lock className="w-4 h-4" />, label: 'Skill gap matrix' },
          { icon: <Lock className="w-4 h-4" />, label: 'Learning library' },
          { icon: <MessageSquare className="w-4 h-4" />, label: 'Career mentor' },
        ].map((it) => item(
          false,
          tier === 'free',
          tier === 'free' ? <Lock className="w-4 h-4" /> : it.icon,
          it.label,
          tier === 'free' ? onUpsell : undefined,
        ))}

        <div className="my-3 border-t border-surface-border" />
        {item(false, false, <History className="w-4 h-4" />, 'History')}
        {item(false, false, <Share2 className="w-4 h-4" />, 'Share')}
      </nav>
    </aside>
  )
}

// ── Welcome strip ───────────────────────────────────────────────────────

function WelcomeStrip({ onRerun }: { onRerun?: () => void }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your AI Resilience Score</h1>
        <p className="text-sm text-gray-500 mt-1">
          Computed just now · Re-run available in 30 days (free) or anytime (Premium)
        </p>
      </div>
      {onRerun && (
        <button
          onClick={onRerun}
          className="text-xs font-medium text-linkedin hover:underline inline-flex items-center gap-1"
        >
          Run a fresh assessment <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Headline scores ─────────────────────────────────────────────────────

function HeadlineScoresCard({
  score, readiness, riskBand, cohortName,
}: { score: number; readiness: number; riskBand: string; cohortName: string }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-7">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Resilience</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-gray-900 tabular-nums">{score}</span>
            <span className="text-sm text-gray-500">/ 100</span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {riskBand}
            </span>
            <span className="text-xs text-gray-500">primary score</span>
          </div>
        </div>
        <div className="md:border-l md:border-surface-border md:pl-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Readiness</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-gray-700 tabular-nums">{readiness}</span>
            <span className="text-sm text-gray-500">/ 100</span>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">how prepared you are <em>today</em></span>
          </div>
        </div>
      </div>

      <div className="mt-7 p-4 bg-linkedin/5 rounded-xl flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-medium text-gray-900">Top quartile among {cohortName}</div>
          <div className="text-xs text-gray-500 mt-0.5">Cohort percentile updates as more peers assess</div>
        </div>
      </div>
    </div>
  )
}

// ── Dimension breakdown ─────────────────────────────────────────────────

function DimensionBreakdownCard({
  factors, tier, onUpsell,
}: { factors: MockResults['scoreFactors'] | undefined; tier: 'free' | 'premium'; onUpsell: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-7">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Your 8 dimensions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Each scored 0–10. Full rationales unlocked in Premium.
          </p>
        </div>
        <span className="text-xs text-gray-500 hidden md:block">read-only · free tier</span>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-x-8 gap-y-4">
        {DIMS.map((d) => {
          const value = pickDim(factors, d.key)
          const pct = Math.max(0, Math.min(100, Math.round(value * 10)))
          return (
            <div key={d.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-900">
                  {d.label}
                  {d.inverse && <span className="text-gray-300 text-[10px] ml-1">(inverse)</span>}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{value.toFixed(1)}</span>
              </div>
              <div className="h-2 bg-surface-off rounded-full overflow-hidden">
                <div className="h-full bg-linkedin rounded-full" style={{ width: `${pct}%` }} />
              </div>
              {tier === 'free' && (
                <button
                  onClick={onUpsell}
                  className="mt-1 text-[11px] text-gray-500 bg-surface-off px-2 py-0.5 rounded inline-flex items-center gap-1 hover:text-linkedin"
                >
                  <Lock className="w-3 h-3" /> Premium unlocks why
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Summary paragraph ───────────────────────────────────────────────────

function SummaryParagraphCard({
  name, score, cohortName, factors, backendResult,
}: { name: string; score: number; cohortName: string; factors: MockResults['scoreFactors'] | undefined; backendResult?: any }) {
  // Prefer a real backend narrative if available.
  const backendSummary: string | undefined =
    backendResult?.executive_summary || backendResult?.summary

  const top = (factors || []).slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0]?.name
  const bottom = (factors || []).slice().sort((a, b) => (a.value || 0) - (b.value || 0))[0]?.name

  const generated =
    `${name}, your resilience score of ${score} ` +
    (score >= 75 ? 'puts you in the top quartile' : score >= 50 ? 'is solid' : 'has meaningful room to grow') +
    (cohortName ? ` among ${cohortName}.` : '. ') +
    (top ? ` Your strongest dimension is ${top.toLowerCase()}.` : '') +
    (bottom ? ` The biggest opportunity sits in ${bottom.toLowerCase()}.` : '')

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-7">
      <h2 className="text-lg font-bold text-gray-900">What your score means</h2>
      <p className="mt-3 text-gray-700 leading-relaxed whitespace-pre-line">
        {backendSummary || generated}
      </p>
      <div className="mt-4 text-xs text-gray-300 italic">
        Short summary · free tier. Premium unlocks per-dim rationales + 90-day plan.
      </div>
    </div>
  )
}

// ── Premium teasers ─────────────────────────────────────────────────────

function PersonalRoadmapTeaser({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-7 relative overflow-hidden">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Your personal AI roadmap</h2>
          <p className="text-sm text-gray-500 mt-1">
            <strong className="text-gray-900">10 personalized actions</strong> ranked by impact, tied to your gaps.
          </p>
        </div>
        <span className="text-xs font-semibold text-gray-500 bg-surface-off px-2 py-1 rounded inline-flex items-center gap-1">
          <Lock className="w-3 h-3" /> Premium
        </span>
      </div>
      <div className="relative">
        <div className="space-y-2 [filter:blur(8px)] select-none pointer-events-none" aria-hidden>
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3 p-3 bg-surface-off rounded-lg">
              <div className="w-7 h-7 bg-linkedin/20 rounded-full flex items-center justify-center text-xs font-semibold text-gray-900">{n}</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Sample action title here</div>
                <div className="text-xs text-gray-500 mt-0.5">Impact: +1.0 · Est. 8 hrs</div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-5 text-center max-w-sm">
            <Lock className="mx-auto w-6 h-6 text-gray-500" />
            <div className="mt-2 font-semibold text-gray-900">10 personalized actions waiting</div>
            <div className="text-xs text-gray-500 mt-1">Ranked by impact. Each tied to your specific score gaps.</div>
            <button
              onClick={onUnlock}
              className="mt-4 bg-linkedin hover:bg-linkedin-dark text-white font-medium px-5 py-2 rounded-full text-sm transition-all"
            >
              Unlock my action plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MentorChatTeaser({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-6">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">AI Career Mentor</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ask anything about your career strategy</p>
        </div>
        <span className="text-[10px] font-semibold text-gray-500 bg-surface-off px-2 py-1 rounded inline-flex items-center gap-1">
          <Lock className="w-3 h-3" /> Premium
        </span>
      </div>
      <div className="bg-surface-off rounded-xl p-3 space-y-2">
        <div className="flex">
          <div className="bg-white border border-surface-border rounded-lg px-3 py-2 text-xs max-w-[80%] text-gray-700">
            What should I learn next given my score?
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-linkedin/10 rounded-lg px-3 py-2 text-xs max-w-[80%] text-gray-700">
            Your weakest dim is governance — consider…
          </div>
        </div>
        <div className="[filter:blur(8px)] select-none pointer-events-none" aria-hidden>
          <div className="flex">
            <div className="bg-white border border-surface-border rounded-lg px-3 py-2 text-xs max-w-[80%] text-gray-700">
              Tell me more about AI governance basics.
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onUnlock}
        className="mt-4 w-full bg-white border border-linkedin text-linkedin hover:bg-linkedin hover:text-white font-medium py-2 rounded-lg text-sm transition-all"
      >
        First message on us → unlock chat
      </button>
    </div>
  )
}

function LearningTeaser({ onUnlock }: { onUnlock: () => void }) {
  const items = [
    { t: 'AWS AI Practitioner Cert', s: '14 hrs · Aligned to AI fluency gap' },
    { t: 'DeepLearning.AI Prompt Engineering', s: '3 hrs · Aligned to AI fluency gap' },
    { t: 'NIST AI RMF for PMs', s: '6 hrs · Aligned to governance gap' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-6">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">Curated learning</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            <strong className="text-gray-900">23 resources</strong> picked for your role + gaps
          </p>
        </div>
        <span className="text-[10px] font-semibold text-gray-500 bg-surface-off px-2 py-1 rounded inline-flex items-center gap-1">
          <Lock className="w-3 h-3" /> Premium
        </span>
      </div>
      <div className="[filter:blur(8px)] select-none pointer-events-none space-y-2" aria-hidden>
        {items.map((it) => (
          <div key={it.t} className="flex items-center gap-2 p-2 bg-surface-off rounded">
            <div className="w-8 h-8 bg-linkedin/20 rounded" />
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-900">{it.t}</div>
              <div className="text-[10px] text-gray-500">{it.s}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onUnlock}
        className="mt-4 w-full bg-white border border-linkedin text-linkedin hover:bg-linkedin hover:text-white font-medium py-2 rounded-lg text-sm transition-all"
      >
        See my 23 resources
      </button>
    </div>
  )
}

// ── Reassess + upsell ───────────────────────────────────────────────────

function ReassessCTA({ tier, onUpsell }: { tier: 'free' | 'premium'; onUpsell: () => void }) {
  return (
    <div className="bg-gradient-to-br from-linkedin/5 to-linkedin/10 border border-linkedin/20 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-3">
          <Clock className="w-6 h-6 text-linkedin shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-gray-900">Your score is fresh</h3>
            <p className="text-sm text-gray-700 mt-1">
              {tier === 'premium'
                ? 'Re-run anytime. We track your trajectory whenever you want.'
                : "Re-run again in 30 days to see how you've changed. Free."}
            </p>
            {tier === 'free' && (
              <p className="text-xs text-gray-500 mt-2">
                <span className="text-linkedin font-medium">Premium = unlimited re-runs</span>
              </p>
            )}
          </div>
        </div>
        {tier === 'free' && (
          <button onClick={onUpsell} className="text-sm font-medium text-linkedin hover:underline inline-flex items-center gap-1">
            Want unlimited? See premium <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function UpsellModal({ onClose, onSubscribe }: { onClose: () => void; onSubscribe?: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-surface-border shadow-xl p-6">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-gray-500 hover:text-gray-900">
          <X className="w-5 h-5" />
        </button>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-linkedin/10">
          <Sparkles className="h-6 w-6 text-linkedin" />
        </div>
        <h2 className="text-center text-xl font-bold text-gray-900">Unlock the full dashboard</h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Premium unlocks per-dim rationales, your personalized action plan, the AI Career Mentor, curated learning, and unlimited re-runs.
        </p>
        <button
          onClick={() => { onSubscribe?.(); onClose() }}
          className="mt-5 w-full bg-linkedin hover:bg-linkedin-dark text-white font-semibold px-4 py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2"
        >
          <TrendingUp className="w-4 h-4" /> See plans
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full bg-white border border-surface-border text-gray-700 hover:bg-surface-off font-medium px-4 py-2.5 rounded-lg text-sm"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
