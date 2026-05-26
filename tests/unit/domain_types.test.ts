import { describe, expect, it } from 'vitest'
import type { Card, Category, ReviewLog, Study } from '@/types/domain'

// Runtime import ensures the module must actually exist (import type is erased and never catches missing files).
// This test fails until src/types/domain.ts is created in step 4.
describe('domain types — module existence', () => {
  it('module resolves and exports required symbols', async () => {
    const mod = await import('@/types/domain')
    expect(mod).toBeDefined()
  })
})

describe('domain types — shape validation', () => {
  it('Category satisfies interface shape', () => {
    const cat: Category = {
      id: '019500a4-2a72-7000-8000-000000000001',
      name: 'Idiomas',
      color: '#FF6B1A',
      createdAt: '2026-05-24T12:00:00Z',
      updatedAt: '2026-05-24T12:00:00Z',
    }
    expect(cat.id).toBeTruthy()
    expect(cat.name).toBe('Idiomas')
  })

  it('Study satisfies interface shape', () => {
    const study: Study = {
      id: '019500a4-2a72-7000-8000-000000000002',
      categoryId: '019500a4-2a72-7000-8000-000000000001',
      method: 'anki',
      name: 'Spanish A2',
      payload: {},
      createdAt: '2026-05-24T12:00:00Z',
      updatedAt: '2026-05-24T12:00:00Z',
    }
    expect(study.method).toBe('anki')
    expect(study.categoryId).toBeTruthy()
  })

  it('Card satisfies interface shape', () => {
    const card: Card = {
      id: '019500a4-2a72-7000-8000-000000000003',
      deckId: '019500a4-2a72-7000-8000-000000000002',
      front: 'casa',
      back: 'house',
      tags: ['noun'],
      stability: 0,
      difficulty: 0,
      due: '2026-05-24T00:00:00Z',
      lastReview: null,
      state: 'new',
      reps: 0,
      lapses: 0,
    }
    expect(card.state).toBe('new')
    expect(card.reps).toBe(0)
  })

  it('ReviewLog satisfies interface shape', () => {
    const log: ReviewLog = {
      id: '019500a4-2a72-7000-8000-000000000004',
      cardId: '019500a4-2a72-7000-8000-000000000003',
      grade: 3,
      reviewedAt: '2026-05-24T12:00:00Z',
      prevStability: 0,
      prevDifficulty: 0,
      prevDue: '2026-05-24T00:00:00Z',
    }
    expect(log.grade).toBe(3)
  })
})
