// Phase 4 — CategoryList component unit tests.
// MUST FAIL (red) until src/features/categories/CategoryList.tsx is created.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryList } from '@/features/categories/CategoryList'
import type { Category } from '@/types/domain'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

const makeCategory = (id: string, name: string): Category => ({
  id,
  name,
  color: null,
  createdAt: '2026-05-24T00:00:00Z',
  updatedAt: '2026-05-24T00:00:00Z',
})

describe('CategoryList', () => {
  // Test #20: empty prop → empty state
  it('shows empty state when categories is empty', () => {
    render(<CategoryList categories={[]} onSelect={vi.fn()} />)
    expect(screen.getByTestId('category-empty-state')).toBeInTheDocument()
  })

  // Test #21: 3 categories → 3 items
  it('renders one item per category', () => {
    const cats = [
      makeCategory('1', 'Idiomas'),
      makeCategory('2', 'Ciencias'),
      makeCategory('3', 'Historia'),
    ]
    render(<CategoryList categories={cats} onSelect={vi.fn()} />)
    const items = screen.getAllByTestId('category-item')
    expect(items).toHaveLength(3)
  })

  // Test #22: click on item calls onSelect with that id
  it('calls onSelect with category id when item is clicked', () => {
    const onSelect = vi.fn()
    const cats = [makeCategory('abc-123', 'Idiomas')]
    render(<CategoryList categories={cats} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('category-item'))
    expect(onSelect).toHaveBeenCalledWith('abc-123')
  })
})
