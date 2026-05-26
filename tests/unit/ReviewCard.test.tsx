// Phase 5 + 8.A.1 — ReviewCard component unit tests.
// MUST FAIL (red) until src/features/methods/anki/ReviewCard.tsx is created.
// Phase 8.A.1 tests (#15-#19) FAIL until react-markdown is integrated.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewCard } from '@/features/methods/anki/ReviewCard'
import type { Card } from '@/types/domain'

const card: Card = {
  id: 'c1',
  deckId: 'deck-1',
  front: 'apple',
  back: 'manzana',
  tags: ['fruit'],
  stability: 0,
  difficulty: 0,
  due: '2026-05-25T00:00:00Z',
  lastReview: null,
  state: 'new',
  reps: 0,
  lapses: 0,
}

describe('ReviewCard', () => {
  // Test #8: phase=front → front visible, back hidden, no grade buttons
  it('renders front text and hides back when phase is front', () => {
    render(<ReviewCard card={card} phase="front" onReveal={vi.fn()} onGrade={vi.fn()} />)
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.queryByText('manzana')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /again|hard|good|easy/i })).not.toBeInTheDocument()
  })

  // Test #9: phase=back → front + back visible, 4 grade buttons present
  it('renders front, back and 4 grade buttons when phase is back', () => {
    render(<ReviewCard card={card} phase="back" onReveal={vi.fn()} onGrade={vi.fn()} />)
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.getByText('manzana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /good/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
  })

  // Test #10: phase=front, click reveal button → onReveal called once
  it('calls onReveal when reveal button is clicked', async () => {
    const onReveal = vi.fn()
    render(<ReviewCard card={card} phase="front" onReveal={onReveal} onGrade={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /show answer|reveal/i }))
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  // Test #11: phase=back, click Again → onGrade(1)
  it('calls onGrade(1) when Again is clicked', async () => {
    const onGrade = vi.fn()
    render(<ReviewCard card={card} phase="back" onReveal={vi.fn()} onGrade={onGrade} />)
    await userEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(onGrade).toHaveBeenCalledWith(1)
  })

  // Test #12: phase=back, click Hard → onGrade(2)
  it('calls onGrade(2) when Hard is clicked', async () => {
    const onGrade = vi.fn()
    render(<ReviewCard card={card} phase="back" onReveal={vi.fn()} onGrade={onGrade} />)
    await userEvent.click(screen.getByRole('button', { name: /hard/i }))
    expect(onGrade).toHaveBeenCalledWith(2)
  })

  // Test #13: phase=back, click Good → onGrade(3)
  it('calls onGrade(3) when Good is clicked', async () => {
    const onGrade = vi.fn()
    render(<ReviewCard card={card} phase="back" onReveal={vi.fn()} onGrade={onGrade} />)
    await userEvent.click(screen.getByRole('button', { name: /good/i }))
    expect(onGrade).toHaveBeenCalledWith(3)
  })

  // Test #14: phase=back, click Easy → onGrade(4)
  it('calls onGrade(4) when Easy is clicked', async () => {
    const onGrade = vi.fn()
    render(<ReviewCard card={card} phase="back" onReveal={vi.fn()} onGrade={onGrade} />)
    await userEvent.click(screen.getByRole('button', { name: /easy/i }))
    expect(onGrade).toHaveBeenCalledWith(4)
  })
})

// Phase 8.A.1 — Markdown rendering tests.
// FAIL until react-markdown is integrated in ReviewCard.tsx.
describe('ReviewCard — markdown rendering (phase 8.A.1)', () => {
  const makeCard = (front: string, back: string): Card => ({
    id: 'md-1', deckId: 'deck-1', front, back, tags: [], stability: 0,
    difficulty: 0, due: '2026-05-26T00:00:00Z', lastReview: null,
    state: 'new', reps: 0, lapses: 0,
  })

  // Test #15: **bold** → <strong> in front
  it('renders bold markdown in front as <strong>', () => {
    const c = makeCard('**negrita**', 'plain')
    render(<ReviewCard card={c} phase="front" onReveal={vi.fn()} onGrade={vi.fn()} />)
    expect(document.querySelector('strong')).toBeInTheDocument()
    expect(document.querySelector('strong')?.textContent).toBe('negrita')
  })

  // Test #16: *italic* → <em> in back
  it('renders italic markdown in back as <em>', () => {
    const c = makeCard('plain', '*cursiva*')
    render(<ReviewCard card={c} phase="back" onReveal={vi.fn()} onGrade={vi.fn()} />)
    expect(document.querySelector('em')).toBeInTheDocument()
    expect(document.querySelector('em')?.textContent).toBe('cursiva')
  })

  // Test #17: `code` → <code> in front
  it('renders inline code in front as <code>', () => {
    const c = makeCard('`código`', 'plain')
    render(<ReviewCard card={c} phase="front" onReveal={vi.fn()} onGrade={vi.fn()} />)
    expect(document.querySelector('code')).toBeInTheDocument()
    expect(document.querySelector('code')?.textContent).toBe('código')
  })

  // Test #18: plain text renders without extra HTML tags
  it('renders plain text without extra block tags', () => {
    const c = makeCard('texto plano', 'plain')
    const { container } = render(<ReviewCard card={c} phase="front" onReveal={vi.fn()} onGrade={vi.fn()} />)
    const front = container.querySelector('[data-testid="card-front"]')
    expect(front?.textContent).toContain('texto plano')
    expect(container.querySelector('strong')).not.toBeInTheDocument()
    expect(container.querySelector('em')).not.toBeInTheDocument()
  })

  // Test #19: list items → <li> in front
  it('renders markdown list as <li> elements', () => {
    const c = makeCard('- item1\n- item2', 'plain')
    render(<ReviewCard card={c} phase="front" onReveal={vi.fn()} onGrade={vi.fn()} />)
    const items = document.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items[0].textContent).toContain('item1')
    expect(items[1].textContent).toContain('item2')
  })
})
