import { z } from 'zod';

export const campusAiProfileSchema = z.object({
  grade: z.string().min(1),
  department: z.string().min(1),
});

export const campusAiSourceSchema = z.object({
  category: z.string(),
  document: z.string(),
  snippet: z.string(),
  score: z.number().finite(),
});

export const campusAiRetrievalSchema = z.object({
  top_k: z.number().int().positive(),
  score_threshold: z.number().finite().nonnegative(),
  matched: z.boolean(),
});

export const campusAiResponseSchema = z.object({
  answer: z.string(),
  profile: campusAiProfileSchema,
  sources: z.array(campusAiSourceSchema),
  has_context: z.boolean(),
  retrieval: campusAiRetrievalSchema,
  request_id: z.string().min(1),
});

export const campusAiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().optional(),
    request_id: z.string().min(1).optional(),
  }),
});

export const campusAiNoticeSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string().default(''),
  type: z.string().default('notice'),
  starts_at: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  target_grade: z.string().default('전체'),
  target_department: z.string().default('전체'),
  created_at: z.string().min(1),
  summary: z.string().nullable().optional(),
  summary_provider: z.string().nullable().optional(),
  notified: z.boolean().default(false),
});

export const campusAiNoticeListSchema = z.object({
  notices: z.array(campusAiNoticeSchema),
  count: z.number().int().nonnegative(),
});

export const campusAiNoticeIngestSchema = z.object({
  skipped: z.boolean(),
  reason: z.string().nullable().optional(),
  notice: campusAiNoticeSchema.nullable().optional(),
  notify_results: z
    .array(
      z.object({
        channel: z.string(),
        ok: z.boolean(),
        error: z.string().optional(),
      }),
    )
    .default([]),
});

export type CampusAiProfile = z.infer<typeof campusAiProfileSchema>;
export type CampusAiResponse = z.infer<typeof campusAiResponseSchema>;
export type CampusAiNotice = z.infer<typeof campusAiNoticeSchema>;
export type CampusAiNoticeList = z.infer<typeof campusAiNoticeListSchema>;
export type CampusAiNoticeIngest = z.infer<typeof campusAiNoticeIngestSchema>;
