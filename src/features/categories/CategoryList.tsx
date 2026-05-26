import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import type { Category } from '@/types/domain'

interface Props {
  categories: Category[]
  onSelect: (id: string) => void
  onRename?: (id: string, newName: string) => void
  onDelete?: (id: string) => void
}

export function CategoryList({ categories, onSelect, onRename, onDelete }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  if (categories.length === 0) {
    return (
      <p
        data-testid="category-empty-state"
        className="text-sm py-4"
        style={{ color: 'var(--text-muted)' }}
      >
        No hay categorías todavía.
      </p>
    )
  }

  const startRename = (cat: Category) => {
    setRenamingId(cat.id)
    setRenameValue(cat.name)
  }

  const commitRename = (id: string) => {
    if (renameValue.trim()) {
      onRename?.(id, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      {categories.map((cat) => (
        <div
          key={cat.id}
          data-testid="category-item"
          className="py-3.5 px-2 -mx-2 cursor-pointer"
          style={{ borderBottom: '1px solid var(--border)' }}
          onClick={() => renamingId !== cat.id && onSelect(cat.id)}
        >
          {renamingId === cat.id ? (
            <div className="flex items-center gap-2">
              <input
                data-testid="input-rename-category"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none py-1"
                style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(cat.id)
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                }}
                autoFocus
              />
              <button
                data-testid="btn-save-rename-category"
                onClick={() => commitRename(cat.id)}
                className="p-1 rounded flex-shrink-0 transition-colors duration-100 hover:opacity-90"
                style={{ color: 'var(--accent)' }}
                title="Guardar nombre"
              >
                <Check size={18} />
              </button>
              <button
                onClick={() => { setRenamingId(null); setRenameValue('') }}
                className="p-1 rounded flex-shrink-0 transition-colors duration-100"
                style={{ color: 'var(--text-muted)' }}
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: cat.color ?? 'var(--text-muted)' }}
              />
              <span
                className="text-sm font-medium flex-1"
                style={{ color: 'var(--text)' }}
              >
                {cat.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  data-testid="btn-rename-category"
                  onClick={(e) => { e.stopPropagation(); startRename(cat) }}
                  className="p-1 rounded transition-colors duration-100"
                  style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  title="Renombrar categoría"
                >
                  <Pencil size={18} />
                </button>
                <button
                  data-testid="btn-delete-category"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(cat.id) }}
                  className="p-1 rounded transition-colors duration-100"
                  style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  title="Eliminar categoría"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
