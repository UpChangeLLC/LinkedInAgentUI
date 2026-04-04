/** Zod schemas for API response validation. */

import { z } from 'zod';

export const AgentTraceStepSchema = z.object({
  step: z.string(),
  success: z.boolean(),
  duration_ms: z.number(),
  info: z.string(),
});

export const AgentRunResponseSchema = z.object({
  status: z.literal('ok'),
  data_source: z.string(),
  trace: z.array(AgentTraceStepSchema),
  result: z.record(z.string(), z.unknown()),
});

export type AgentRunResponse = z.infer<typeof AgentRunResponseSchema>;

export const StatsResponseSchema = z.object({
  total_assessments: z.number(),
  recent_assessments: z.array(
    z.object({
      role_category: z.string().optional(),
      score: z.number().nullable().optional(),
      created_at: z.string().nullable().optional(),
    })
  ),
});

export type StatsResponse = z.infer<typeof StatsResponseSchema>;
