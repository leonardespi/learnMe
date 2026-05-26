// In-memory IPC mock for non-Tauri contexts (browser dev, Playwright E2E against npm run dev).
// Activated only when window.__TAURI_INTERNALS__ is absent.
import type { Category, Study, Card, ReviewLog } from '@/types/domain'

interface MockState {
  categories: Category[]
  studies: Study[]
  cards: Card[]
  settings: Record<string, string>
}

declare global {
  interface Window {
    __MOCK_STATE__?: MockState
    __MOCK_RESET__?: boolean
    __CURRENT_STUDY_ID__?: string
  }
}

const state: MockState = { categories: [], studies: [], cards: [], settings: {} }

// Expose state for E2E test assertions and wire mock:import event for Playwright tests
if (typeof window !== 'undefined') {
  window.__MOCK_STATE__ = state

  // Pick up E2E seed injected before page load via page.addInitScript
  const seed = (window as unknown as Record<string, unknown>).__MOCK_SEED_STUDY__
  if (seed && typeof seed === 'object') {
    const s = seed as { id: string; categoryId: string; name: string; method: string }
    state.studies.push({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
      method: s.method,
      payload: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  window.addEventListener('mock:import', (e: Event) => {
    const { fixturePath } = (e as CustomEvent<{ fixturePath: string }>).detail
    const studyId = window.__CURRENT_STUDY_ID__
    if (!studyId) return
    fetch(fixturePath)
      .then((r) => r.json())
      // any-justified: fixture JSON shape is user-controlled in test context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((deck: any) => handleMockIPC('import_anki_deck', { studyId, deck }))
      .catch(console.error)
  })


}

function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

// any-justified: Tauri IPC handler receives unknown payload shapes at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleMockIPC(cmd: string, args: Record<string, any>): unknown {
  switch (cmd) {
    case 'category_list':
      return [...state.categories].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

    case 'category_create': {
      const { name, color } = args.payload ?? args
      const cat: Category = { id: uuid(), name, color: color ?? null, createdAt: now(), updatedAt: now() }
      state.categories.push(cat)
      return cat
    }

    case 'category_update': {
      const { id, name, color } = args
      const idx = state.categories.findIndex((c) => c.id === id)
      if (idx === -1) throw new Error('Not found')
      state.categories[idx] = { ...state.categories[idx], name, color: color ?? null, updatedAt: now() }
      return state.categories[idx]
    }

    case 'category_delete': {
      const { id } = args
      const idx = state.categories.findIndex((c) => c.id === id)
      if (idx === -1) throw new Error('Not found')
      state.categories.splice(idx, 1)
      return null
    }

    case 'study_create': {
      const { category_id, method, name, payload } = args.payload ?? args
      const study: Study = {
        id: uuid(),
        categoryId: category_id,
        method,
        name,
        payload: payload ?? {},
        createdAt: now(),
        updatedAt: now(),
      }
      state.studies.push(study)
      return study
    }

    case 'study_list_by_category': {
      const { categoryId } = args
      return state.studies
        .filter((s) => s.categoryId === categoryId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    case 'study_update': {
      const { id, name } = args
      const idx = state.studies.findIndex((s) => s.id === id)
      if (idx === -1) throw new Error('Not found')
      state.studies[idx] = { ...state.studies[idx], name, updatedAt: now() }
      return state.studies[idx]
    }

    case 'study_delete': {
      const { id } = args
      state.cards = state.cards.filter((c) => c.deckId !== id)
      const idx = state.studies.findIndex((s) => s.id === id)
      if (idx === -1) throw new Error('Not found')
      state.studies.splice(idx, 1)
      return null
    }

    case 'card_list_by_deck': {
      const { deckId } = args
      return state.cards.filter((c) => c.deckId === deckId)
    }

    case 'card_delete': {
      const { id } = args
      const idx = state.cards.findIndex((c) => c.id === id)
      if (idx === -1) throw new Error('Not found')
      state.cards.splice(idx, 1)
      return null
    }

    case 'import_anki_deck': {
      const { studyId: study_id, deck } = args
      const deckId = (study_id as string) ?? uuid()
      const deckData = deck as { cards?: Array<{ front: string; back: string; tags?: string[] }> }
      const rawCards = deckData?.cards ?? []
      const existingKeys = new Set(state.cards.filter(c => c.deckId === deckId).map(c => `${c.front}||${c.back}`))
      const toInsert = rawCards.filter(c => !existingKeys.has(`${c.front}||${c.back}`))
      const newCards: Card[] = toInsert.map(c => ({
        id: uuid(),
        deckId,
        front: c.front,
        back: c.back,
        tags: c.tags ?? [],
        stability: 0,
        difficulty: 0,
        due: now(),
        lastReview: null,
        state: 'new',
        reps: 0,
        lapses: 0,
      }))
      state.cards.push(...newCards)
      return { inserted: newCards.length, skipped: rawCards.length - newCards.length }
    }

    case 'settings_get': {
      const { key } = args
      return localStorage.getItem(`mock_setting:${key}`) ?? null
    }

    case 'settings_set': {
      const { key, value } = args
      localStorage.setItem(`mock_setting:${key}`, value)
      return null
    }

    case 'next_card': {
      const { deckId: deck_id, newLimit: new_limit = 20 } = args
      const nowStr = new Date().toISOString()
      const deckCards = state.cards.filter((c) => c.deckId === deck_id)

      // Priority 1: learning/relearning cards that are due
      const urgent = deckCards.find(
        (c) => (c.state === 'learning' || c.state === 'relearning') && c.due <= nowStr,
      )
      if (urgent) return urgent

      // Priority 2: review cards that are due
      const review = deckCards.find((c) => c.state === 'review' && c.due <= nowStr)
      if (review) return review

      // Priority 3: new cards (respecting cap)
      if ((new_limit as number) > 0) {
        const newCard = deckCards.find((c) => c.state === 'new')
        if (newCard) return newCard
      }

      return null
    }

    case 'record_review': {
      const { cardId: card_id, grade } = args
      const idx = state.cards.findIndex((c) => c.id === card_id)
      if (idx === -1) throw new Error(`Card not found: ${card_id}`)

      const card = state.cards[idx]
      const futureDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const futureMinute = new Date(Date.now() + 60 * 1000).toISOString()
      const nowStr = new Date().toISOString()

      const updated: Card = { ...card }

      if ((grade as number) === 1) {
        // Again: move to learning/relearning, short interval
        updated.state = card.state === 'new' ? 'learning' : 'relearning'
        updated.lapses = card.state !== 'new' ? card.lapses + 1 : card.lapses
        updated.due = futureMinute
      } else {
        // Hard/Good/Easy: move to learning (from new) or review (from learning/review)
        updated.state = card.state === 'new' || card.state === 'learning' ? 'learning' : 'review'
        if ((grade as number) === 4) updated.state = 'review'
        updated.reps = card.reps + 1
        updated.due = futureDay
        updated.lastReview = nowStr
        updated.stability = Math.max(card.stability + (grade as number) * 0.1, 0.1)
      }

      state.cards[idx] = updated

      const log: ReviewLog = {
        id: uuid(),
        cardId: card_id as string,
        grade: grade as number,
        reviewedAt: nowStr,
        prevStability: card.stability,
        prevDifficulty: card.difficulty,
        prevDue: card.due,
      }

      return { card: updated, reviewLog: log }
    }

    case 'get_stats':
      return fetch('/fixtures/stats/stats-snapshot.json').then((r) => r.json())

    case 'study_list_all':
      return [...state.studies]

    case 'session_export':
      return null

    case 'session_import_cmd': {
      const simulateError = args.simulateError
      if (simulateError) throw new Error(simulateError as string)
      return null
    }

    default:
      return null
  }
}
