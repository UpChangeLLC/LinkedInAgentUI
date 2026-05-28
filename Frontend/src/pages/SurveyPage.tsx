import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { QuestionCard } from '../components/survey/QuestionCard'
import { SurveyProgressBar, type ScrapeStatus } from '../components/survey/SurveyProgressBar'
import { MultiSelectFrequency } from '../components/survey/MultiSelectFrequency'
import { ShortText } from '../components/survey/ShortText'
import { SingleSelectPill } from '../components/survey/SingleSelectPill'
import { LikertScale } from '../components/survey/LikertScale'
import { RepetitiveSlider } from '../components/survey/RepetitiveSlider'
import {
  isSurveyComplete,
  surveyResponseSchema,
  type SurveyResponse,
} from '../lib/survey'
import { loadDraft, saveDraft } from '../lib/surveyDraft'

interface SurveyPageProps {
  onSubmit: (responses: SurveyResponse) => void
  onBack: () => void
  /** Stable id used to scope the localStorage draft to this run. */
  draftKey: string
  scrapeStatus: ScrapeStatus
}

const TOTAL = 10

/** One question per slide; Back / Next walk the user through, with submit
 * enabled only on the final slide when every required answer is set. */
export function SurveyPage({ onSubmit, onBack, draftKey, scrapeStatus }: SurveyPageProps) {
  const [r, setR] = useState<Partial<SurveyResponse>>({})
  const [step, setStep] = useState(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const draft = loadDraft(draftKey)
    if (draft) setR(draft.responses)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  // The slider has a visible default (50%), so initialize the underlying state
  // when the user lands on step 8 — otherwise Next stays disabled until they
  // physically move the slider, which the UI doesn't communicate.
  useEffect(() => {
    if (step === 8 && r.q_ae_1 === undefined) {
      setR((prev) => ({ ...prev, q_ae_1: 50 }))
    }
  }, [step, r.q_ae_1])

  const update = (patch: Partial<SurveyResponse>) => {
    setR((prev) => {
      const next = { ...prev, ...patch }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveDraft(draftKey, next), 500)
      return next
    })
  }

  // Required-answer check per slide. Steps 2 / 9 / 10 are optional.
  const stepAnswered = (s: number): boolean => {
    switch (s) {
      case 1: return !!r.q_ai_1 && Object.keys(r.q_ai_1).length > 0
      case 2: return true
      case 3: return r.q_ga_1 !== undefined
      case 4: return r.q_lv_1 !== undefined
      case 5: return r.q_lv_2 !== undefined
      case 6: return r.q_nr_1 !== undefined
      case 7: return r.q_nr_2 !== undefined
      case 8: return r.q_ae_1 !== undefined
      default: return true
    }
  }

  const complete = isSurveyComplete(r)
  const onLastStep = step === TOTAL
  const canAdvance = stepAnswered(step)

  const goNext = () => {
    if (!canAdvance) return
    setStep((s) => Math.min(TOTAL, s + 1))
    window.scrollTo(0, 0)
  }
  const goBack = () => {
    if (step === 1) {
      onBack()
      return
    }
    setStep((s) => Math.max(1, s - 1))
    window.scrollTo(0, 0)
  }

  const handleSubmit = () => {
    const parsed = surveyResponseSchema.safeParse(r)
    if (!parsed.success) {
      // Should never happen — the gate (complete + stepAnswered) prevents it.
      // eslint-disable-next-line no-console
      console.warn('survey schema validation failed', parsed.error.flatten())
      return
    }
    onSubmit(parsed.data)
  }

  return (
    <motion.div
      key="survey"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="min-h-screen bg-white"
    >
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-linkedin flex items-center justify-center">
              <span className="text-white font-bold text-sm">u</span>
            </div>
            <span className="font-semibold text-[15px] text-gray-900">Upchange</span>
          </div>
          <button onClick={goBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pt-10 pb-12">
        <SurveyProgressBar step={step} total={TOTAL} scrapeStatus={scrapeStatus} />

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {renderStep(step, r, update)}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 1 ? 'Cancel' : 'Previous'}
          </button>
          <div className="text-xs text-gray-500">Auto-saving your answers</div>

          {onLastStep ? (
            <button
              type="button"
              data-test="survey-submit"
              disabled={!complete}
              onClick={handleSubmit}
              className="rounded-lg bg-linkedin hover:bg-linkedin-dark px-6 py-2.5 text-sm font-semibold text-white transition-all enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              See my score
            </button>
          ) : (
            <button
              type="button"
              data-test="survey-next"
              disabled={!canAdvance}
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-lg bg-linkedin hover:bg-linkedin-dark px-6 py-2.5 text-sm font-semibold text-white transition-all enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-gray-300">
          Auto-saved · You can leave and come back · 90s avg completion
        </p>
      </div>
    </motion.div>
  )
}

function renderStep(
  step: number,
  r: Partial<SurveyResponse>,
  update: (patch: Partial<SurveyResponse>) => void,
): React.ReactNode {
  switch (step) {
    case 1:
      return (
        <QuestionCard index={1} dim="D-AI" total={TOTAL} question="Which AI tools do you use, and how often?" helpText="Tap a cell for each tool you use.">
          <MultiSelectFrequency value={r.q_ai_1} onChange={(v) => update({ q_ai_1: v as SurveyResponse['q_ai_1'] })} />
        </QuestionCard>
      )
    case 2:
      return (
        <QuestionCard index={2} dim="D-AI" total={TOTAL} optional question="What do you mainly use AI for?" helpText="Example: drafting emails, code review, brainstorming.">
          <ShortText value={r.q_ai_2} onChange={(v) => update({ q_ai_2: v })} ariaLabel="What you use AI for" placeholder="Drafting email replies, code review…" />
        </QuestionCard>
      )
    case 3:
      return (
        <QuestionCard index={3} dim="D-GA" total={TOTAL} question="Do you work on AI governance or responsible-AI topics?" helpText="Compliance, privacy, AI risk reviews, etc.">
          <SingleSelectPill
            ariaLabel="AI governance involvement"
            value={r.q_ga_1}
            onChange={(v) => update({ q_ga_1: v as SurveyResponse['q_ga_1'] })}
            options={[
              { value: 'no', label: 'No' },
              { value: 'sometimes', label: 'Sometimes' },
              { value: 'partial', label: 'Partially' },
              { value: 'yes', label: 'Yes' },
            ]}
          />
        </QuestionCard>
      )
    case 4:
      return (
        <QuestionCard index={4} dim="D-LV" total={TOTAL} question="How many courses or certifications have you completed in the last year?">
          <SingleSelectPill
            ariaLabel="Courses completed last year"
            value={r.q_lv_1}
            onChange={(v) => update({ q_lv_1: v as SurveyResponse['q_lv_1'] })}
            options={[
              { value: '0', label: '0' },
              { value: '1-2', label: '1–2' },
              { value: '3-5', label: '3–5' },
              { value: '6+', label: '6+' },
            ]}
          />
        </QuestionCard>
      )
    case 5:
      return (
        <QuestionCard index={5} dim="D-LV" total={TOTAL} question="“I actively seek out new skills and tools.”">
          <LikertScale ariaLabel="I actively seek new skills" value={r.q_lv_2} onChange={(v) => update({ q_lv_2: v })} lowAnchor="Strongly disagree" highAnchor="Strongly agree" />
        </QuestionCard>
      )
    case 6:
      return (
        <QuestionCard index={6} dim="D-NR" total={TOTAL} question="How easy is it for you to reach people in your field for advice?">
          <LikertScale ariaLabel="Ease of reaching your network" value={r.q_nr_1} onChange={(v) => update({ q_nr_1: v })} lowAnchor="Very difficult" highAnchor="Very easy" />
        </QuestionCard>
      )
    case 7:
      return (
        <QuestionCard index={7} dim="D-NR" total={TOTAL} question="Do you share your work or ideas publicly (posts, talks, open source)?">
          <SingleSelectPill
            ariaLabel="Public sharing frequency"
            value={r.q_nr_2}
            onChange={(v) => update({ q_nr_2: v as SurveyResponse['q_nr_2'] })}
            options={[
              { value: 'no', label: 'No' },
              { value: 'occasionally', label: 'Occasionally' },
              { value: 'yes', label: 'Yes' },
            ]}
          />
        </QuestionCard>
      )
    case 8:
      return (
        <QuestionCard index={8} dim="D-AE" total={TOTAL} question="How much of your day-to-day work is repetitive vs. novel?">
          <RepetitiveSlider ariaLabel="Repetitive vs novel work" value={r.q_ae_1} onChange={(v) => update({ q_ae_1: v })} />
        </QuestionCard>
      )
    case 9:
      return (
        <QuestionCard index={9} dim="D-RW" total={TOTAL} optional question="Do you manage or lead a team?" helpText="Helps us tailor recommendations. Optional.">
          <SingleSelectPill
            ariaLabel="Leadership"
            value={r.q_rw_1}
            onChange={(v) => update({ q_rw_1: v as SurveyResponse['q_rw_1'] })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
          />
        </QuestionCard>
      )
    case 10:
      return (
        <QuestionCard index={10} dim="D-RW" total={TOTAL} optional question="Are you currently exploring a role change?" helpText="Helps us tailor recommendations. Optional.">
          <SingleSelectPill
            ariaLabel="Exploring a role change"
            value={r.q_rw_2}
            onChange={(v) => update({ q_rw_2: v as SurveyResponse['q_rw_2'] })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
          />
        </QuestionCard>
      )
    default:
      return null
  }
}
