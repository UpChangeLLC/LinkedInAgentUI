import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

interface LandingPageProps {
  onGetStarted: () => void
  onLogin?: () => void
  onSubscriptions?: () => void
  accountName?: string
  onDashboard?: () => void
  onRecalculate?: () => void
  onLogout?: () => void
  onCareerMentor?: () => void
}

/** Mock-aligned landing (see Career-AI/onboarding-flow-mock.html §SCREEN 1).
 * Two-column hero on light surfaces with a sample-assessment radar on the
 * right. Theme-aware: dark mode keeps the existing palette via the dark-*
 * tokens (light is the primary aesthetic). */
export function LandingPage({
  onGetStarted,
  onLogin,
  onSubscriptions,
  accountName,
  onDashboard,
  onRecalculate,
  onLogout,
}: LandingPageProps) {
  const isAuthed = Boolean(accountName)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-white"
    >
      {/* Top nav */}
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo variant="compact" size="md" className="text-gray-900" />
            <span className="text-gray-500 text-xs ml-2 hidden md:inline">AI Resilience Score</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-700">
            <a href="#how-it-works" className="hidden md:inline hover:text-linkedin">How it works</a>
            {onSubscriptions && (
              <button onClick={onSubscriptions} className="hidden md:inline hover:text-linkedin">
                Pricing
              </button>
            )}
            {isAuthed && onDashboard && (
              <button onClick={onDashboard} className="hover:text-linkedin">Dashboard</button>
            )}
            {isAuthed && onLogout ? (
              <button onClick={onLogout} className="hover:text-linkedin">Log out</button>
            ) : (
              onLogin && (
                <button onClick={onLogin} className="hover:text-linkedin">Log in</button>
              )
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 md:pt-20 pb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block text-[11px] font-semibold tracking-wider uppercase text-linkedin bg-linkedin/10 px-2.5 py-1 rounded">
                New · Resilience Score v1
              </span>
              <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-[1.1] text-gray-900">
                How AI-resilient<br />is your career?
              </h1>
              <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-md">
                Get a personalized AI Resilience Score in under 3 minutes — based on your LinkedIn,
                O*NET role data, and a 90-second survey. Free.
              </p>
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={isAuthed && onDashboard ? onDashboard : onGetStarted}
                  className="bg-linkedin hover:bg-linkedin-dark text-white font-medium px-7 py-3 rounded-full text-[15px] transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                >
                  {isAuthed && onDashboard ? 'Go to dashboard' : 'Get my score'}
                </button>
                <span className="text-sm text-gray-500">No credit card. ~3 min.</span>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-linkedin" />
                  GDPR compliant
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-linkedin" />
                  O*NET-anchored
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-linkedin" />
                  No LinkedIn login
                </div>
              </div>
            </div>

            {/* Sample assessment card */}
            <SampleAssessmentCard />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="bg-linkedin-bg/40 border-y border-surface-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">How it works</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">Three steps. About three minutes.</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            <Step n={1} title="Drop your LinkedIn URL" body="We pull role, skills, and experience. No login required." />
            <Step n={2} title="Answer 9 quick questions" body="90 seconds. Auto-saving. Profile parse runs in parallel." />
            <Step n={3} title="See your score + breakdown" body="Free dashboard with the 8-dim radar, cohort percentile, and a personalized summary." />
          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-surface-border py-10 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <p className="text-gray-500 text-sm">
            © 2024 AI Resilience Score™. A product of{' '}
            <span className="font-semibold text-gray-700">UpChange LLC</span>.
          </p>
          <p className="text-gray-400 text-xs leading-relaxed max-w-xl mx-auto">
            AI Resilience Score™ is not affiliated with, endorsed by, or connected to LinkedIn Corporation.
            We use publicly available data, LLM-generated analysis, and our own proprietary models to generate results.
          </p>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      {!isAuthed && (
        <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-white border-t border-surface-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <Button fullWidth onClick={onGetStarted} className="bg-linkedin hover:bg-linkedin-dark">
            Get my score
          </Button>
        </div>
      )}

      {/* Silence unused-prop warning for onRecalculate (kept for App.tsx parity). */}
      <span hidden aria-hidden>{onRecalculate ? '' : ''}</span>
    </motion.div>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl border border-surface-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-linkedin/10 text-linkedin text-sm font-semibold">
          {n}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
    </div>
  )
}

/** Decorative sample-assessment card — mirrors the mock's hero illustration. */
function SampleAssessmentCard() {
  return (
    <div className="relative">
      <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-8 max-w-md mx-auto">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sample assessment</div>
        <div className="mt-4 flex items-baseline gap-2">
          <div className="text-6xl font-bold text-gray-900">74</div>
          <div className="text-sm text-gray-500">/ 100 resilience</div>
        </div>
        <div className="mt-2">
          <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            Top 28% among Product Managers
          </span>
        </div>

        <div className="mt-6" aria-hidden>
          <svg viewBox="0 0 200 200" className="w-full h-44" role="img" aria-label="Sample 8-dimension radar">
            <g stroke="#E0E0E0" fill="none" strokeWidth="1">
              <polygon points="100,20 167,60 167,140 100,180 33,140 33,60" />
              <polygon points="100,50 142,75 142,125 100,150 58,125 58,75" />
              <polygon points="100,80 117,90 117,110 100,120 83,110 83,90" />
            </g>
            <g stroke="#E0E0E0" strokeWidth="1">
              <line x1="100" y1="100" x2="100" y2="20" />
              <line x1="100" y1="100" x2="167" y2="60" />
              <line x1="100" y1="100" x2="167" y2="140" />
              <line x1="100" y1="100" x2="100" y2="180" />
              <line x1="100" y1="100" x2="33" y2="140" />
              <line x1="100" y1="100" x2="33" y2="60" />
            </g>
            <polygon
              points="100,30 155,68 145,135 100,160 50,125 45,70"
              fill="#0A66C2"
              fillOpacity={0.15}
              stroke="#0A66C2"
              strokeWidth={1.8}
            />
          </svg>
        </div>

        <div className="mt-2 text-[11px] text-gray-300 text-center">8-dimension breakdown — free</div>
      </div>
    </div>
  )
}
