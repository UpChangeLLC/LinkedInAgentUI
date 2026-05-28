import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { PipelineProgress as PipelineProgressType } from '../hooks/useAppState'

interface AnalyzingPageProps {
  onComplete: () => void
  pipelineProgress: PipelineProgressType
}

interface Stage {
  label: string
  detail: string
  /** Progress percentage at which this stage starts. */
  startsAt: number
}

const STAGES: Stage[] = [
  { label: 'Stage 1 — Parsing your profile', detail: 'Extracting role, skills, certs, experience', startsAt: 0 },
  { label: 'Stage 2 — Mapping your role',    detail: 'Anchoring to O*NET role data',              startsAt: 25 },
  { label: 'Stage 3 — Scoring 8 dimensions', detail: '4 deterministic · 4 AI-judged',             startsAt: 45 },
  { label: 'Stage 4 — Aggregating signals',  detail: 'Combining with monotonic constraints',     startsAt: 70 },
  { label: 'Stage 5 — Calibrating + explaining', detail: 'SHAP attribution + cohort percentile + narrative', startsAt: 88 },
]

type Status = 'done' | 'running' | 'pending'

function stageStatus(progress: number, i: number): Status {
  const next = STAGES[i + 1]
  if (next && progress >= next.startsAt) return 'done'
  if (progress >= STAGES[i].startsAt) return 'running'
  return 'pending'
}

/** Mock-aligned analyzing page (mock §SCREEN 5): white card, central spinner,
 * 5-stage status list driven by the real SSE pipeline progress. */
export function AnalyzingPage({ pipelineProgress }: AnalyzingPageProps) {
  const progress = Math.max(0, Math.min(100, pipelineProgress.progress || 0))
  const elapsed = Math.floor(pipelineProgress.elapsedMs / 1000)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-white"
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

      <div className="max-w-2xl mx-auto px-6 pt-16 pb-12">
        <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-10">
          <div className="text-center">
            <Spinner />
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Computing your resilience score…</h2>
            <p className="mt-3 text-gray-500">
              This usually takes 15–30 seconds. We're running the four-stage pipeline on your profile + survey.
            </p>
            <p className="mt-2 text-xs text-gray-300 font-mono">Analyzing for {elapsed}s</p>
          </div>

          <div className="mt-8 space-y-3">
            {STAGES.map((s, i) => (
              <StageRow key={s.label} stage={s} status={stageStatus(progress, i)} />
            ))}
          </div>

          <div className="mt-8">
            <div className="h-1.5 w-full bg-surface-off rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-linkedin"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 text-right">{Math.round(progress)}% complete</p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-gray-300">
          We score on 8 dimensions across automation exposure, technical proximity, execution credibility,
          leadership readiness, AI fluency, governance awareness, learning velocity, and network relevance.
        </p>
      </div>
    </motion.div>
  )
}

function Spinner() {
  return (
    <div
      className="mx-auto h-12 w-12 rounded-full border-[3px] border-linkedin border-t-transparent animate-spin"
      aria-label="Loading"
    />
  )
}

function StageRow({ stage, status }: { stage: Stage; status: Status }) {
  const bg = status === 'done'
    ? 'bg-emerald-50'
    : status === 'running'
      ? 'bg-linkedin/5 border border-linkedin/20'
      : 'bg-surface-off/60'

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${bg}`}>
      <StatusDot status={status} />
      <div className="flex-1">
        <div className={`text-sm font-medium ${status === 'pending' ? 'text-gray-500' : 'text-gray-900'}`}>
          {stage.label}
        </div>
        <div className={`text-xs ${status === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
          {stage.detail}
        </div>
      </div>
      {status === 'done' && <span className="text-xs text-emerald-700 font-medium">done</span>}
      {status === 'running' && <span className="text-xs text-linkedin font-medium">running…</span>}
    </div>
  )
}

function StatusDot({ status }: { status: Status }) {
  if (status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
        <Check className="w-3 h-3" />
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-linkedin border-t-transparent animate-spin" />
    )
  }
  return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
}
