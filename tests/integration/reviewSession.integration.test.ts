// Phase 5 — useReviewSession integration tests (sequential mock backend).
// MUST FAIL (red) until src/features/methods/anki/hooks/useReviewSession.ts is created.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReviewSession } from '@/features/methods/anki/hooks/useReviewSession'
import type { Card, RecordReviewResult } from '@/types/domain'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeCard = (id: string): Card => ({
  id,
  deckId: 'deck-int',
  front: `front-${id}`,
  back: `back-${id}`,
  tags: [],
  stability: 0,
  difficulty: 0,
  due: new Date(Date.now() - 1000).toISOString(),
  lastReview: null,
  state: 'new',
  reps: 0,
  lapses: 0,
})

const makeReviewResult = (card: Card, grade: number): RecordReviewResult => ({
  card: { ...card, state: 'learning', reps: card.reps + 1, due: new Date(Date.now() + 86400000).toISOString() },
  reviewLog: {
    id: `log-${card.id}`,
    cardId: card.id,
    grade,
    reviewedAt: new Date().toISOString(),
    prevStability: card.stability,
    prevDifficulty: card.difficulty,
    prevDue: card.due,
  },
})

beforeEach(() => { mockInvoke.mockReset() })

describe('useReviewSession integration', () => {
  // Integration test 1: complete 3-card session end-to-end
  it('completes a 3-card session: record_review x3, next_card x4, phase=complete', async () => {
    const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')]
    let nextCallCount = 0
    const recordReviewCalls: Array<{ cardId: string; grade: number }> = []

    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'next_card') {
        const card = cards[nextCallCount] ?? null
        nextCallCount++
        return Promise.resolve(card)
      }
      if (cmd === 'record_review') {
        const call = { cardId: args?.cardId as string, grade: args?.grade as number }
        recordReviewCalls.push(call)
        const card = cards.find((c) => c.id === call.cardId) ?? cards[0]
        return Promise.resolve(makeReviewResult(card, call.grade))
      }
      return Promise.resolve(null)
    })

    const { result } = renderHook(() => useReviewSession('deck-int'))
    await act(async () => {})

    for (let i = 0; i < 3; i++) {
      expect(result.current.phase).toBe('front')
      await act(async () => { result.current.reveal() })
      expect(result.current.phase).toBe('back')
      await act(async () => { await result.current.grade(3) })
    }

    expect(recordReviewCalls).toHaveLength(3)
    expect(recordReviewCalls.every((c) => c.grade === 3)).toBe(true)
    expect(recordReviewCalls.map((c) => c.cardId)).toEqual(['c1', 'c2', 'c3'])
    expect(nextCallCount).toBe(4)
    expect(result.current.phase).toBe('complete')
    expect(result.current.progress.done).toBe(3)
  })

  // Integration test 2: unmount + remount preserves DB state (mock resets session counter)
  it('remount after partial session starts fresh counter, DB state from mock is preserved', async () => {
    const cards = [makeCard('a1'), makeCard('a2'), makeCard('a3'), makeCard('a4'), makeCard('a5')]
    // Simulate: after grading 2 cards, they get future due → mock returns remaining 3 new ones on remount
    const remaining = cards.slice(2)
    let phase = 'first' // first mount serves cards[0], cards[1]; second mount serves remaining
    let firstMountCount = 0
    let secondMountCount = 0

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') {
        if (phase === 'first') {
          const card = cards[firstMountCount] ?? null
          firstMountCount++
          return Promise.resolve(card)
        } else {
          const card = remaining[secondMountCount] ?? null
          secondMountCount++
          return Promise.resolve(card)
        }
      }
      if (cmd === 'record_review') {
        const card = cards[firstMountCount - 1] ?? cards[0]
        return Promise.resolve(makeReviewResult(card, 3))
      }
      return Promise.resolve(null)
    })

    // First mount: grade 2 cards
    const { result: r1, unmount } = renderHook(() => useReviewSession('deck-int'))
    await act(async () => {})
    await act(async () => { r1.current.reveal() })
    await act(async () => { await r1.current.grade(3) })
    await act(async () => { r1.current.reveal() })
    await act(async () => { await r1.current.grade(3) })

    expect(r1.current.progress.done).toBe(2)
    unmount()

    // Switch mock to second-mount mode
    phase = 'second'

    // Remount: session starts fresh, remaining 3 cards available
    const { result: r2 } = renderHook(() => useReviewSession('deck-int'))
    await act(async () => {})

    expect(r2.current.phase).toBe('front')
    expect(r2.current.progress.done).toBe(0)
    expect(r2.current.currentCard?.id).toBe('a3')
    expect(r2.current.progress.total).toBe(3)
  })
})
