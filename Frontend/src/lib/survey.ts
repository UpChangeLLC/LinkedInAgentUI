// Onboarding survey schema (spec 01 §4.1). Mirrors the backend Pydantic shape.
import { z } from 'zod'

export const FREQUENCY = ['none', 'tried', 'weekly', 'daily'] as const

export const surveyResponseSchema = z.object({
  // D-AI — AI tool usage by frequency
  q_ai_1: z.record(z.string(), z.enum(FREQUENCY)),
  q_ai_2: z.string().max(140).optional(), // free text — optional in v1

  // D-GA — governance awareness
  q_ga_1: z.enum(['no', 'sometimes', 'partial', 'yes']),

  // D-LV — learning velocity
  q_lv_1: z.enum(['0', '1-2', '3-5', '6+']),
  q_lv_2: z.number().int().min(1).max(5),

  // D-NR — network relevance
  q_nr_1: z.number().int().min(1).max(5),
  q_nr_2: z.enum(['no', 'occasionally', 'yes']),

  // D-AE — automation exposure cross-check
  q_ae_1: z.number().int().min(0).max(100),

  // Runway items (recommendations only, privacy-sensitive, skippable)
  q_rw_2: z.enum(['yes', 'no', 'prefer_not_to_say']).optional(),
})

export type SurveyResponse = z.infer<typeof surveyResponseSchema>

/** Questions that must be answered before the survey can be submitted. */
export const REQUIRED_QUESTION_IDS = [
  'q_ai_1', 'q_ga_1', 'q_lv_1', 'q_lv_2', 'q_nr_1', 'q_nr_2', 'q_ae_1',
] as const

/** All question ids in display order. */
export const QUESTION_IDS = [
  'q_ai_1', 'q_ai_2', 'q_ga_1', 'q_lv_1', 'q_lv_2',
  'q_nr_1', 'q_nr_2', 'q_ae_1', 'q_rw_2',
] as const

/** True when every required question has a non-empty answer. */
export function isSurveyComplete(partial: Partial<SurveyResponse>): boolean {
  return REQUIRED_QUESTION_IDS.every((id) => {
    const v = (partial as Record<string, unknown>)[id]
    if (v === undefined || v === null) return false
    if (id === 'q_ai_1') return v && typeof v === 'object' && Object.keys(v as object).length > 0
    return true
  })
}
