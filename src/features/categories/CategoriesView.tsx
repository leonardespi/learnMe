import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { CategoryList } from './CategoryList'
import { useAppStore } from '@/store/appStore'
import type { Category } from '@/types/domain'

export function CategoriesView() {
  const navigateToCategoryDetail = useAppStore((s) => s.navigateToCategoryDetail)
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => invoke('category_list'),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      invoke('category_create', { payload: { name, color: null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setShowForm(false)
      setNewName('')
      setError(null)
    },
    onError: (err: unknown) => {
      setError(String(err))
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      invoke('category_update', { id, name, color: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: console.error,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('category_delete', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: console.error,
  })

  const handleSave = () => {
    if (!newName.trim()) { setError('Nombre requerido'); return }
    createMutation.mutate(newName.trim())
  }

  return (
    <div data-testid="categories-view" className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Categorías
        </h1>
        <button
          data-testid="btn-new-category"
          onClick={() => setShowForm(true)}
          className="text-xs font-medium transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          + Nueva categoría
        </button>
      </div>

      {showForm && (
        <div
          className="flex items-center gap-3 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <input
            data-testid="input-category-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 bg-transparent text-sm outline-none py-1 px-0"
            style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          {error && <span className="text-xs text-red-500 flex-shrink-0">{error}</span>}
          <button
            data-testid="btn-save-category"
            onClick={handleSave}
            className="text-xs font-medium px-2 py-1 hover:opacity-70 flex-shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            Guardar
          </button>
          <button
            onClick={() => { setShowForm(false); setNewName(''); setError(null) }}
            className="text-xs px-2 py-1 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      )}

      <CategoryList
        categories={categories}
        onSelect={navigateToCategoryDetail}
        onRename={(id, name) => renameMutation.mutate({ id, name })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  )
}
