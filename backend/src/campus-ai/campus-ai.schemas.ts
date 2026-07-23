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

export type CampusAiProfile = z.infer<typeof campusAiProfileSchema>;
export type CampusAiResponse = z.infer<typeof campusAiResponseSchema>;
