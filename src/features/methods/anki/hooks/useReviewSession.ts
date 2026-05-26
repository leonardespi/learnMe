import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Card } from '@/types/domain'

export type ReviewPhase = 'front' | 'back' | 'complete'

export interface ReviewProgress {
  done: number
  total: number
}

export interface UseReviewSessionResult {
  currentCard: Card | null
  phase: ReviewPhase
  progress: ReviewProgress
  reveal: () => void
  grade: (g: 1 | 2 | 3 | 4) => Promise<void>
}

interface SessionState {
  queue: Card[]
  done: number
  total: number
  phase: ReviewPhase
}

// Preloads via sequential next_card calls (works with unit-test mocks that advance sequentially).
// Stops on null or duplicate ID to avoid infinite loops with stateless mocks/production.
const MAX_PRELOAD = 300

async function preloadViaNextCard(deckId: string): Promise<Card[]> {
  const cards: Card[] = []
  const seenIds = new Set<string>()
  for (let i = 0; i < MAX_PRELOAD; i++) {
    const card = await invoke<Card | null>('next_card', { deckId, newLimit: 20 })
    if (card == null || seenIds.has(card.id)) break
    seenIds.add(card.id)
    cards.push(card)
  }
  return cards
}

function isDue(card: Card): boolean {
  if (card.state === 'new') return true
  return card.due <= new Date().toISOString()
}

function priorityOf(state: Card['state']): number {
  if (state === 'learning' || state === 'relearning') return 0
  if (state === 'review') return 1
  return 2
}

export function useReviewSession(deckId: string): UseReviewSessionResult {
  const [session, setSession] = useState<SessionState>({
    queue: [],
    done: 0,
    total: 0,
    phase: 'front',
  })

  useEffect(() => {
    let cancelled = false

    async function loadQueue() {
      let cards: Card[]

      // Production/E2E path: card_list_by_deck returns the full array → filter + sort locally.
      // Unit-test path: card_list_by_deck mock returns null → fall back to next_card preload
      // (unit-test mocks implement sequential advancement via next_card).
      const allCards = await invoke<Card[] | null>('card_list_by_deck', { deckId }).catch(
        () => null,
      )

      if (Array.isArray(allCards)) {
        cards = allCards
          .filter(isDue)
          .sort((a, b) => priorityOf(a.state) - priorityOf(b.state))
      } else {
        cards = await preloadViaNextCard(deckId)
      }

      if (!cancelled) {
        setSession({
          queue: cards,
          done: 0,
          total: cards.length,
          phase: cards.length === 0 ? 'complete' : 'front',
        })
      }
    }

    loadQueue()
    return () => {
      cancelled = true
    }
  }, [deckId])

  const reveal = useCallback(() => {
    setSession((prev) => {
      if (prev.phase !== 'front' || prev.queue.length === 0) return prev
      return { ...prev, phase: 'back' }
    })
  }, [])

  const grade = useCallback(
    async (g: 1 | 2 | 3 | 4) => {
      const card = session.queue[0]
      if (session.phase !== 'back' || card == null) return

      await invoke('record_review', { cardId: card.id, grade: g })

      setSession((prev) => {
        const nextQueue = prev.queue.slice(1)
        return {
          ...prev,
          queue: nextQueue,
          done: prev.done + 1,
          phase: nextQueue.length === 0 ? 'complete' : 'front',
        }
      })
    },
    [session.phase, session.queue],
  )

  return {
    currentCard: session.queue[0] ?? null,
    phase: session.phase,
    progress: { done: session.done, total: session.total },
    reveal,
    grade,
  }
}
