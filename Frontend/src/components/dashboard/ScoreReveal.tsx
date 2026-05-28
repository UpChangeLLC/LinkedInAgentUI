import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { MockResults } from '../../data/mockResults'
import { trackEvent } from '../../lib/analytics'

interface ScoreRevealProps {
  results: MockResults
  onComplete: () => void
}

/** Mock-aligned reveal (Career-AI/onboarding-flow-mock.html §SCREEN 6): a
 * full-screen white card with a count-up of the resilience score, the
 * risk-band + cohort pills, a one-line narrative, and a 'See my full
 * breakdown' CTA that closes the overlay onto the dashboard. */
export function ScoreReveal({ results, onComplete }: ScoreRevealProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const target = Math.max(0, Math.min(100, results.score ?? 0))

  useEffect(() => {
    try { trackEvent('score_revealed', { score: target, riskBand: results.riskBand }) } catch { /* ignore */ }
    const duration = 1100
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayScore(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const startHandle = setTimeout(() => { raf = requestAnimationFrame(tick) }, 250)
    return () => { clearTimeout(startHandle); cancelAnimationFrame(raf) }
  }, [target, results.riskBand])

  const riskBand = results.riskBand || ''
  const cohortLabel = results.personalProfile?.title
    ? `Among ${results.personalProfile.title}s`
    : 'Your cohort'
  const summary =
    target >= 75
      ? "You're well-positioned for the AI shift. Several dimensions sit above your cohort — see the breakdown next."
      : target >= 50
        ? "You're in the middle of the pack. The biggest opportunity sits in a couple of dimensions — see the breakdown next."
        : "There's meaningful room to grow. We've identified concrete actions to lift your score — see the breakdown next."

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-white flex flex-col"
        role="dialog"
        aria-label="Score reveal"
      >
        <header className="bg-white border-b border-surface-border">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-linkedin flex items-center justify-center">
                <span className="text-white font-bold text-sm">u</span>
              </div>
              <span className="font-semibold text-[15px] text-gray-900">Upchange</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
          <motion.div
            initial={{ y: 14, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl border border-surface-border shadow-sm p-10 md:p-12 max-w-2xl w-full text-center"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-linkedin">
              Your AI Resilience Score
            </div>

            <div className="mt-8 flex items-baseline justify-center gap-4">
              <div className="text-8xl md:text-9xl font-bold leading-none text-gray-900 tracking-tight tabular-nums">
                {displayScore}
              </div>
              <div className="text-xl text-gray-500">/ 100</div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="mt-4 flex items-center justify-center gap-3 flex-wrap"
            >
              {riskBand && (
                <span className="inline-block text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  {riskBand}
                </span>
              )}
              <span className="inline-block text-xs font-semibold text-linkedin bg-linkedin/10 px-3 py-1.5 rounded-full">
                {cohortLabel}
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
              className="mt-7 max-w-lg mx-auto text-gray-500 leading-relaxed"
            >
              {summary}
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.4 }}
              onClick={onComplete}
              className="mt-9 inline-flex items-center gap-2 bg-linkedin hover:bg-linkedin-dark text-white font-medium px-8 py-3 rounded-full text-[15px] transition-all hover:-translate-y-0.5 shadow-sm"
            >
              See my full breakdown <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
