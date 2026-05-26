import { z } from 'zod'

const LearnemeCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().nullable(),
})

const LearnmeStudySchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string().min(1),
  method: z.string(),
})

const LearnmeCardSchema = z.object({
  id: z.string(),
  studyId: z.string(),
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()),
  state: z.enum(['new', 'learning', 'review', 'relearning']),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  due: z.string(),
  lastReviewed: z.string().nullable(),
})

const LearnmeReviewLogSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  grade: z.number().int().min(1).max(4),
  reviewedAt: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  reviewState: z.number().int(),
})

const LearnmeDataSchema = z.object({
  categories: z.array(LearnemeCategorySchema),
  studies: z.array(LearnmeStudySchema),
  cards: z.array(LearnmeCardSchema),
  reviewLogs: z.array(LearnmeReviewLogSchema),
})

export const LearnmeFileSchema = z.object({
  version: z.number().int().nonnegative(),
  generatedAt: z.string(),
  appVersion: z.string(),
  checksum: z.string().min(1),
  data: LearnmeDataSchema,
})

export type LearnmeFile = z.infer<typeof LearnmeFileSchema>
export type LearnmeCard = z.infer<typeof LearnmeCardSchema>
export type LearnmeData = z.infer<typeof LearnmeDataSchema>
