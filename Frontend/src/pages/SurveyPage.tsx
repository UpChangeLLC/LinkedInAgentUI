import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { QuestionCard } from '../components/survey/QuestionCard'
import { SurveyProgressBar, type ScrapeStatus } from '../components/survey/SurveyProgressBar'
import { MultiSelectFrequency } from '../components/survey/MultiSelectFrequency'
import { ShortText } from '../components/survey/ShortText'
import { SingleSelectPill } from '../components/survey/SingleSelectPill'
import { LikertScale } from '../components/survey/LikertScale'
import { RepetitiveSlider } from '../components/survey/RepetitiveSlider'
import {
  isSurveyComplete,
  REQUIRED_QUESTION_IDS,
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

export function SurveyPage({ onSubmit, onBack, draftKey, scrapeStatus }: SurveyPageProps) {
  const [r, setR] = useState<Partial<SurveyResponse>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore a matching draft once on mount.
  useEffect(() => {
    const draft = loadDraft(draftKey)
    if (draft) setR(draft.responses)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  // Debounced draft save on every change.
  const update = (patch: Partial<SurveyResponse>) => {
    setR((prev) => {
      const next = { ...prev, ...patch }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveDraft(draftKey, next), 500)
      return next
    })
  }

  const answeredCount = REQUIRED_QUESTION_IDS.filter((id) => {
    const v = (r as Record<string, unknown>)[id]
    if (id === 'q_ai_1') return v && Object.keys(v as object).length > 0
    return v !== undefined && v !== null
  }).length

  const complete = isSurveyComplete(r)

  const handleSubmit = () => {
    const parsed = surveyResponseSchema.safeParse(r)
    if (!parsed.success) return
    onSubmit(parsed.data)
  }

  return (
    <motion.div
      key="survey"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="min-h-screen bg-dark-bg text-dark-textPri"
    >
      <SurveyProgressBar answered={answeredCount} total={TOTAL} scrapeStatus={scrapeStatus} />

      <div className="mx-auto max-w-2xl px-4 py-6">
        <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-dark-textMuted hover:text-dark-textSec">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <p className="mb-6 text-sm text-dark-textSec">
          90 seconds, 10 quick questions. We're reading your profile in the background while you answer.
        </p>

        <div className="space-y-4" data-test="survey-questions">
          <QuestionCard index={1} total={TOTAL} question="Which AI tools do you use, and how often?" helpText="Tap a cell for each tool you use.">
            <MultiSelectFrequency value={r.q_ai_1} onChange={(v) => update({ q_ai_1: v as SurveyResponse['q_ai_1'] })} />
          </QuestionCard>

          <QuestionCard index={2} total={TOTAL} optional question="What do you mainly use AI for?" helpText="Example: drafting emails, code review, brainstorming.">
            <ShortText value={r.q_ai_2} onChange={(v) => update({ q_ai_2: v })} ariaLabel="What you use AI for" placeholder="Drafting email replies, code review…" />
          </QuestionCard>

          <QuestionCard index={3} total={TOTAL} question="Do you work on AI governance or responsible-AI topics?" helpText="Compliance, privacy, AI risk reviews, etc.">
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

          <QuestionCard index={4} total={TOTAL} question="How many courses or certifications have you completed in the last year?">
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

          <QuestionCard index={5} total={TOTAL} question="“I actively seek out new skills and tools.”">
            <LikertScale ariaLabel="I actively seek new skills" value={r.q_lv_2} onChange={(v) => update({ q_lv_2: v })} lowAnchor="Strongly disagree" highAnchor="Strongly agree" />
          </QuestionCard>

          <QuestionCard index={6} total={TOTAL} question="How easy is it for you to reach people in your field for advice?">
            <LikertScale ariaLabel="Ease of reaching your network" value={r.q_nr_1} onChange={(v) => update({ q_nr_1: v })} lowAnchor="Very difficult" highAnchor="Very easy" />
          </QuestionCard>

          <QuestionCard index={7} total={TOTAL} question="Do you share your work or ideas publicly (posts, talks, open source)?">
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

          <QuestionCard index={8} total={TOTAL} question="How much of your day-to-day work is repetitive vs. novel?">
            <RepetitiveSlider ariaLabel="Repetitive vs novel work" value={r.q_ae_1} onChange={(v) => update({ q_ae_1: v })} />
          </QuestionCard>

          <QuestionCard index={9} total={TOTAL} optional question="Do you manage or lead a team?" helpText="Helps us tailor recommendations. Optional.">
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

          <QuestionCard index={10} total={TOTAL} optional question="Are you currently exploring a role change?" helpText="Helps us tailor recommendations. Optional.">
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
        </div>

        <button
          type="button"
          data-test="survey-submit"
          disabled={!complete}
          onClick={handleSubmit}
          className="mt-6 w-full rounded-lg bg-linkedin py-3 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          See my score
        </button>
      </div>
    </motion.div>
  )
}
