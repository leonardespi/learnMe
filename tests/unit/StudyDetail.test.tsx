// Phase 4 + 8.A.1 — StudyDetail component unit tests.
// MUST FAIL (red) until src/features/studies/StudyDetail.tsx is created.
// Phase 8.A.1 tests (#32-#36) FAIL until edit/delete card props are added.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudyDetail } from '@/features/studies/StudyDetail'
import type { Card } from '@/types/domain'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

const makeCard = (id: string, front: string): Card => ({
  id,
  deckId: 'deck-1',
  front,
  back: 'back',
  tags: [],
  stability: 0,
  difficulty: 0,
  due: '2026-05-24T00:00:00Z',
  lastReview: null,
  state: 'new',
  reps: 0,
  lapses: 0,
})

describe('StudyDetail', () => {
  // Test #28: empty cards → empty state element
  it('shows empty state when cards is empty', () => {
    render(<StudyDetail cards={[]} onImport={vi.fn()} onAddCard={vi.fn()} />)
    expect(screen.getByTestId('card-empty-state')).toBeInTheDocument()
  })

  // Test #29: one card → card-item with front text
  it('renders card items with front text', () => {
    const cards = [makeCard('c1', 'casa')]
    render(<StudyDetail cards={cards} onImport={vi.fn()} onAddCard={vi.fn()} />)
    const item = screen.getByTestId('card-item')
    expect(item).toBeInTheDocument()
    expect(item).toHaveTextContent('casa')
  })

  // Test #30: import button present
  it('renders import button', () => {
    render(<StudyDetail cards={[]} onImport={vi.fn()} onAddCard={vi.fn()} />)
    expect(screen.getByText(/importar/i)).toBeInTheDocument()
  })

  // Test #31: add card button present
  it('renders add card button', () => {
    render(<StudyDetail cards={[]} onImport={vi.fn()} onAddCard={vi.fn()} />)
    expect(screen.getByText(/agregar carta/i)).toBeInTheDocument()
  })
})

// Phase 8.A.1 — Card CRUD controls in StudyDetail.
// Tests #32-#36 FAIL until onDeleteCard/onUpdateCard props are added and controls rendered.
describe('StudyDetail — card CRUD (phase 8.A.1)', () => {
  const card = makeCard('c1', 'casa')

  // Test #32: each card row has edit and delete buttons
  it('renders btn-edit-card and btn-delete-card per card', () => {
    render(
      <StudyDetail
        cards={[card]}
        onImport={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onUpdateCard={vi.fn()}
      />
    )
    expect(screen.getByTestId('btn-edit-card')).toBeInTheDocument()
    expect(screen.getByTestId('btn-delete-card')).toBeInTheDocument()
  })

  // Test #33: click btn-edit-card → inline edit panel appears with pre-loaded front
  it('shows edit panel with card front pre-loaded on edit click', () => {
    render(
      <StudyDetail
        cards={[card]}
        onImport={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onUpdateCard={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('btn-edit-card'))
    expect(screen.getByTestId('card-edit-panel')).toBeInTheDocument()
    const frontInput = screen.getByTestId('input-edit-front') as HTMLInputElement
    expect(frontInput.value).toBe('casa')
  })

  // Test #34: save edit → onUpdateCard called with updated values
  it('calls onUpdateCard with new front/back when saved', () => {
    const onUpdateCard = vi.fn()
    render(
      <StudyDetail
        cards={[card]}
        onImport={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onUpdateCard={onUpdateCard}
      />
    )
    fireEvent.click(screen.getByTestId('btn-edit-card'))
    fireEvent.change(screen.getByTestId('input-edit-front'), { target: { value: 'hogar' } })
    fireEvent.click(screen.getByTestId('btn-save-edit'))
    expect(onUpdateCard).toHaveBeenCalledWith('c1', 'hogar', 'back', [])
  })

  // Test #35: click btn-delete-card → onDeleteCard called with card id
  it('calls onDeleteCard with card id on delete click', () => {
    const onDeleteCard = vi.fn()
    render(
      <StudyDetail
        cards={[card]}
        onImport={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={onDeleteCard}
        onUpdateCard={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('btn-delete-card'))
    expect(onDeleteCard).toHaveBeenCalledWith('c1')
  })

  // Test #36: empty cards still shows empty state (regression)
  it('empty state still shows when cards=[] with new props', () => {
    render(
      <StudyDetail
        cards={[]}
        onImport={vi.fn()}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onUpdateCard={vi.fn()}
      />
    )
    expect(screen.getByTestId('card-empty-state')).toBeInTheDocument()
  })
})
