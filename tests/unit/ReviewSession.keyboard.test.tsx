// Phase 5 — ReviewSession keyboard shortcut unit tests.
// MUST FAIL (red) until src/features/methods/anki/ReviewSession.tsx is created.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewSession } from '@/features/methods/anki/ReviewSession'
import type { Card, RecordReviewResult } from '@/types/domain'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

const makeCard = (id: string): Card => ({
  id,
  deckId: 'deck-kb',
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

const makeReviewResult = (card: Card): RecordReviewResult => ({
  card: { ...card, state: 'learning', reps: 1 },
  reviewLog: {
    id: 'log-1',
    cardId: card.id,
    grade: 3,
    reviewedAt: new Date().toISOString(),
    prevStability: card.stability,
    prevDifficulty: card.difficulty,
    prevDue: card.due,
  },
})

beforeEach(() => { mockInvoke.mockReset() })

describe('ReviewSession keyboard shortcuts', () => {
  // Test #15: Space while phase=front → reveal (back becomes visible)
  it('Space reveals the card when phase is front', async () => {
    const cardA = makeCard('c1')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})

    expect(screen.queryByText(`back-c1`)).not.toBeInTheDocument()
    await userEvent.keyboard(' ')
    expect(screen.getByText(`back-c1`)).toBeInTheDocument()
  })

  // Test #16: '1' while phase=back → grade(1) dispatched
  it('key 1 calls grade(1) when phase is back', async () => {
    const cardA = makeCard('c1')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA))
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})
    await userEvent.keyboard(' ')
    await act(async () => {})

    await userEvent.keyboard('1')
    await act(async () => {})

    expect(mockInvoke).toHaveBeenCalledWith('record_review', expect.objectContaining({ grade: 1 }))
  })

  // Test #17: '2' while phase=back → grade(2)
  it('key 2 calls grade(2) when phase is back', async () => {
    const cardA = makeCard('c2')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA))
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})
    await userEvent.keyboard(' ')
    await act(async () => {})

    await userEvent.keyboard('2')
    await act(async () => {})

    expect(mockInvoke).toHaveBeenCalledWith('record_review', expect.objectContaining({ grade: 2 }))
  })

  // Test #18: '3' while phase=back → grade(3)
  it('key 3 calls grade(3) when phase is back', async () => {
    const cardA = makeCard('c3')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA))
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})
    await userEvent.keyboard(' ')
    await act(async () => {})

    await userEvent.keyboard('3')
    await act(async () => {})

    expect(mockInvoke).toHaveBeenCalledWith('record_review', expect.objectContaining({ grade: 3 }))
  })

  // Test #19: '4' while phase=back → grade(4)
  it('key 4 calls grade(4) when phase is back', async () => {
    const cardA = makeCard('c4')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      if (cmd === 'record_review') return Promise.resolve(makeReviewResult(cardA))
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})
    await userEvent.keyboard(' ')
    await act(async () => {})

    await userEvent.keyboard('4')
    await act(async () => {})

    expect(mockInvoke).toHaveBeenCalledWith('record_review', expect.objectContaining({ grade: 4 }))
  })

  // Test #20: '1' while phase=front → record_review NOT called
  it('key 1 is ignored when phase is front', async () => {
    const cardA = makeCard('c1')
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(cardA)
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})

    expect(screen.queryByText('back-c1')).not.toBeInTheDocument()
    await userEvent.keyboard('1')

    expect(mockInvoke).not.toHaveBeenCalledWith('record_review', expect.anything())
    expect(screen.queryByText('back-c1')).not.toBeInTheDocument()
  })

  // Test #21: Space and '3' while phase=complete → no action
  it('keyboard shortcuts are no-ops when session is complete', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'next_card') return Promise.resolve(null)
      return Promise.resolve(null)
    })

    render(<ReviewSession deckId="deck-kb" />)
    await act(async () => {})

    expect(screen.getByTestId('session-complete')).toBeInTheDocument()

    await userEvent.keyboard(' ')
    await userEvent.keyboard('3')

    expect(mockInvoke).not.toHaveBeenCalledWith('record_review', expect.anything())
  })
})
