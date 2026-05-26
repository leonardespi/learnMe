// Phase 8.A.1 — CategoriesView CRUD controls tests.
// Tests FAIL until rename/delete buttons are added to CategoriesView/CategoryList.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { CategoriesView } from '@/features/categories/CategoriesView'
import { useAppStore } from '@/store/appStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockCategories = [
  { id: 'cat-1', name: 'Idiomas', color: null, createdAt: '2026-05-26T00:00:00Z', updatedAt: '2026-05-26T00:00:00Z' },
]

function renderView() {
  vi.mocked(invoke).mockImplementation((cmd: string) => {
    if (cmd === 'category_list') return Promise.resolve(mockCategories)
    return Promise.resolve(null)
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CategoriesView />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAppStore.setState({ view: { name: 'categories' } })
  vi.clearAllMocks()
})

describe('CategoriesView — CRUD controls (phase 8.A.1)', () => {
  // Test #37: category row has rename and delete buttons
  it('renders btn-rename-category and btn-delete-category per category', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('category-item')).toBeInTheDocument())
    expect(screen.getByTestId('btn-rename-category')).toBeInTheDocument()
    expect(screen.getByTestId('btn-delete-category')).toBeInTheDocument()
  })

  // Test #38: click rename → inline input appears with current name
  it('shows rename input with current name on rename click', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('category-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-rename-category'))
    const input = screen.getByTestId('input-rename-category') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('Idiomas')
  })

  // Test #39: submit rename → invoke category_update called
  it('calls invoke category_update on rename submit', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('category-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-rename-category'))
    fireEvent.change(screen.getByTestId('input-rename-category'), { target: { value: 'Lenguas' } })
    fireEvent.click(screen.getByTestId('btn-save-rename-category'))
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('category_update', expect.objectContaining({ id: 'cat-1', name: 'Lenguas' }))
    })
  })

  // Test #40: click delete → invoke category_delete called
  it('calls invoke category_delete on delete click', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('category-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-delete-category'))
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('category_delete', expect.objectContaining({ id: 'cat-1' }))
    })
  })

  // Test #41: empty state regression — still shows when no categories
  it('shows empty state when categories list is empty', async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'category_list') return Promise.resolve([])
      return Promise.resolve(null)
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><CategoriesView /></QueryClientProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('category-empty-state')).toBeInTheDocument()
    })
  })
})
