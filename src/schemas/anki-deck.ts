import { z } from 'zod'

const AnkiCardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()).default([]),
  // Optional FSRS fields — present in roundtrip exports, absent in manual imports
  stability: z.number().optional(),
  difficulty: z.number().optional(),
  due: z.string().optional(),
  lastReview: z.string().nullable().optional(),
  state: z.enum(['new', 'learning', 'review', 'relearning']).optional(),
  reps: z.number().int().nonnegative().optional(),
  lapses: z.number().int().nonnegative().optional(),
})

export const AnkiDeckSchema = z.object({
  schemaVersion: z.string(),
  method: z.literal('anki'),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  cards: z.array(AnkiCardSchema),
})

export type AnkiDeck = z.infer<typeof AnkiDeckSchema>
export type AnkiCard = z.infer<typeof AnkiCardSchema>
