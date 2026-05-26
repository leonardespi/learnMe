export interface Category {
  id: string
  name: string
  color: string | null
  createdAt: string
  updatedAt: string
}

export interface Study {
  id: string
  categoryId: string
  method: string
  name: string
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  tags: string[]
  stability: number
  difficulty: number
  due: string
  lastReview: string | null
  state: CardState
  reps: number
  lapses: number
}

export interface ReviewLog {
  id: string
  cardId: string
  grade: number
  reviewedAt: string
  prevStability: number
  prevDifficulty: number
  prevDue: string
}

export interface RecordReviewResult {
  card: Card
  reviewLog: ReviewLog
}
