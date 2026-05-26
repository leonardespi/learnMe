// Phase 5 — useReviewSession hook unit tests.
// MUST FAIL (red) until src/features/methods/anki/hooks/useReviewSession.ts is created.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReviewSession } from '@/features/methods/anki/hooks/useReviewSession'
import type { Card, RecordReviewResult } from '@/types/domain'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeCard = (id: string, front = 'front', state: Card['state'] = 'new'): Card => ({
  id,
  deckId: 'deck-1',
  front,
  back: 'back',
  tags: [],
  stability: 0,
  difficulty: 0,
  due: new Date(Date.now() - 1000).toISOString(),
  lastReview: null,
  state,
  reps: 0,
  lapses: 0,
})

const makeReviewResult = (card: Card, grade: number): RecordReviewResult => ({
  card: { ...card, state: 'learning', reps: 1, due: new Date(Date.now() + 86400000).toISOString() },
  reviewLog: {
    id: 'log-1',
    cardId: card.id,
    grade,
    reviewedAt: new Date().toISOString(),
    prevStability: card.stability,
    prevDifficulty: card.difficulty,
    prevDue: card.due,
  },
})

beforeEach(() => {
  mockInvoke.mockReset()
})

describe('useReviewSession', () => {
  // Test #1: mount → loads first card, phase = front, progress.done = 0
  it('loads first card on mount and sets phase front', async () => {
    const cardA = makeCard('c1', 'apple')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})

    expect(result.current.currentCard).toEqual(cardA)
    expect(result.current.phase).toBe('front')
    expect(result.current.progress.done).toBe(0)
    expect(result.current.progress.total).toBeGreaterThanOrEqual(1)
  })

  // Test #2: reveal() transitions phase front → back, no record_review call
  it('reveal transitions phase to back without calling record_review', async () => {
    const cardA = makeCard('c1')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})

    await act(async () => { result.current.reveal() })

    expect(result.current.phase).toBe('back')
    expect(mockInvoke).not.toHaveBeenCalledWith('record_review', expect.anything())
  })

  // Test #3: grade(3) → record_review called, next card loaded, progress.done = 1
  it('grade advances to next card and increments progress.done', async () => {
    const cardA = makeCard('c1', 'apple')
    const cardB = makeCard('c2', 'bread')
    let nextCallCount = 0
    mockInvoke.mockImplementation((cmd: string, args: Record<string, unknown>) => {
      if (cmd === 'next_card') {
        nextCallCount++
        return Promise.resolve(nextCallCount === 1 ? cardA : cardB)
      }
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA, args.grade as number))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})
    await act(async () => { result.current.reveal() })
    await act(async () => { await result.current.grade(3) })

    expect(mockInvoke).toHaveBeenCalledWith('record_review', expect.objectContaining({ cardId: 'c1', grade: 3 }))
    expect(result.current.currentCard).toEqual(cardB)
    expect(result.current.phase).toBe('front')
    expect(result.current.progress.done).toBe(1)
  })

  // Test #4: grade when next_card returns null → phase = complete
  it('grade sets phase complete when next_card returns null', async () => {
    const cardA = makeCard('c1')
    let nextCallCount = 0
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') {
        nextCallCount++
        return Promise.resolve(nextCallCount === 1 ? cardA : null)
      }
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA, 3))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})
    await act(async () => { result.current.reveal() })
    await act(async () => { await result.current.grade(1) })

    expect(result.current.phase).toBe('complete')
    expect(result.current.currentCard).toBeNull()
  })

  // Test #5: grade while phase = front → record_review NOT called, phase unchanged
  it('grade while phase front is a no-op', async () => {
    const cardA = makeCard('c1')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})

    expect(result.current.phase).toBe('front')
    await act(async () => { await result.current.grade(3) })

    expect(mockInvoke).not.toHaveBeenCalledWith('record_review', expect.anything())
    expect(result.current.phase).toBe('front')
  })

  // Test #6: deck with 0 pending cards → phase = complete immediately
  it('sets phase complete immediately when deck has no pending cards', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(null)
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-2'))
    await act(async () => {})

    expect(result.current.phase).toBe('complete')
    expect(result.current.currentCard).toBeNull()
  })

  // Test #7: progress.done increments 0→1→2→3 across 3 grades, total = 3 at start
  it('progress.done increments correctly across multiple grades', async () => {
    const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')]
    let nextCallCount = 0
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'next_card') {
        const card = cards[nextCallCount] ?? null
        nextCallCount++
        return Promise.resolve(card)
      }
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cards[0], (args?.grade as number) ?? 3))
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-1'))
    await act(async () => {})
    expect(result.current.progress.done).toBe(0)
    expect(result.current.progress.total).toBe(3)

    for (let i = 0; i < 3; i++) {
      await act(async () => { result.current.reveal() })
      await act(async () => { await result.current.grade(3) })
      if (i < 2) expect(result.current.progress.done).toBe(i + 1)
    }
  })
})
