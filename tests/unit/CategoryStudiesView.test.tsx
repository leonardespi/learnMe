// Phase 8.A.1 — CategoryStudiesView CRUD controls tests.
// Tests FAIL until rename/delete deck buttons are added to CategoryStudiesView.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { CategoryStudiesView } from '@/features/studies/StudiesView'
import { useAppStore } from '@/store/appStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockStudies = [
  { id: 'study-1', categoryId: 'cat-1', name: 'Spanish A2', method: 'anki', payload: {}, createdAt: '2026-05-26T00:00:00Z', updatedAt: '2026-05-26T00:00:00Z' },
]

function renderView(categoryId = 'cat-1') {
  vi.mocked(invoke).mockImplementation((cmd: string) => {
    if (cmd === 'study_list_by_category') return Promise.resolve(mockStudies)
    return Promise.resolve(null)
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CategoryStudiesView categoryId={categoryId} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAppStore.setState({ view: { name: 'categories' } })
  vi.clearAllMocks()
})

describe('CategoryStudiesView — CRUD controls (phase 8.A.1)', () => {
  // Test #42: study row has rename and delete buttons
  it('renders btn-rename-deck and btn-delete-deck per study', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('study-item')).toBeInTheDocument())
    expect(screen.getByTestId('btn-rename-deck')).toBeInTheDocument()
    expect(screen.getByTestId('btn-delete-deck')).toBeInTheDocument()
  })

  // Test #43: click delete → invoke study_delete called
  it('calls invoke study_delete on delete click', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('study-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-delete-deck'))
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('study_delete', expect.objectContaining({ id: 'study-1' }))
    })
  })

  // Test #44: click rename → inline input appears with current name
  it('shows rename input with current name on rename click', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('study-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-rename-deck'))
    const input = screen.getByTestId('input-rename-deck') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('Spanish A2')
  })

  // Test #45: submit rename → invoke study_update called
  it('calls invoke study_update on rename submit', async () => {
    renderView()
    await waitFor(() => expect(screen.getByTestId('study-item')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-rename-deck'))
    fireEvent.change(screen.getByTestId('input-rename-deck'), { target: { value: 'Spanish B1' } })
    fireEvent.click(screen.getByTestId('btn-save-rename-deck'))
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('study_update', expect.objectContaining({ id: 'study-1', name: 'Spanish B1' }))
    })
  })
})
