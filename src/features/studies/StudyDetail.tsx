import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import type { Card } from '@/types/domain'

interface Props {
  cards: Card[]
  onImport: () => void
  onAddCard: () => void
  onDeleteCard?: (id: string) => void
  onUpdateCard?: (id: string, front: string, back: string, tags: string[]) => void
}

const STATE_STYLE: Record<string, { color: string; bg: string }> = {
  new: { color: '#2563eb', bg: 'rgba(219,234,254,0.6)' },
  review: { color: '#059669', bg: 'rgba(209,250,229,0.6)' },
  learning: { color: '#d97706', bg: 'rgba(254,243,199,0.6)' },
  relearning: { color: '#9333ea', bg: 'rgba(243,232,255,0.6)' },
}

interface EditState {
  id: string
  front: string
  back: string
  tags: string[]
}

export function StudyDetail({ cards, onImport, onAddCard, onDeleteCard, onUpdateCard }: Props) {
  const [editing, setEditing] = useState<EditState | null>(null)

  const startEdit = (card: Card) => {
    setEditing({ id: card.id, front: card.front, back: card.back, tags: card.tags })
  }

  const saveEdit = () => {
    if (!editing) return
    onUpdateCard?.(editing.id, editing.front, editing.back, editing.tags)
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          data-testid="btn-import"
          onClick={onImport}
          className="text-xs font-medium px-3 py-1.5 rounded transition-colors duration-100"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Importar .json
        </button>
        <button
          data-testid="btn-add-card"
          onClick={onAddCard}
          className="text-xs font-medium px-3 py-1.5 rounded transition-colors duration-100"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          + Agregar carta
        </button>
      </div>

      {cards.length === 0 ? (
        <p
          data-testid="card-empty-state"
          className="text-sm py-6"
          style={{ color: 'var(--text-muted)' }}
        >
          No hay cartas todavía. Importa un mazo para comenzar.
        </p>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {cards.map((card) => {
            const s = STATE_STYLE[card.state] ?? STATE_STYLE.new
            const isEditing = editing?.id === card.id
            return (
              <div
                key={card.id}
                data-testid="card-item"
                className="py-3 px-2 -mx-2"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {isEditing ? (
                  <div data-testid="card-edit-panel" className="space-y-2">
                    <input
                      data-testid="input-edit-front"
                      value={editing.front}
                      onChange={(e) => setEditing({ ...editing, front: e.target.value })}
                      className="w-full bg-transparent text-sm outline-none py-1"
                      style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
                      placeholder="Anverso"
                    />
                    <input
                      data-testid="input-edit-back"
                      value={editing.back}
                      onChange={(e) => setEditing({ ...editing, back: e.target.value })}
                      className="w-full bg-transparent text-sm outline-none py-1"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                      placeholder="Reverso"
                    />
                    <div className="flex gap-1 pt-1">
                      <button
                        data-testid="btn-save-edit"
                        onClick={saveEdit}
                        className="p-1 rounded transition-colors duration-100 hover:opacity-80"
                        style={{ color: 'var(--accent)' }}
                        title="Guardar cambios"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)' }}
                        title="Cancelar"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm flex-1 truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {card.front}
                    </span>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <span
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: s.color, background: s.bg }}
                      >
                        {card.state}
                      </span>
                      <button
                        data-testid="btn-edit-card"
                        onClick={() => startEdit(card)}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        title="Editar carta"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        data-testid="btn-delete-card"
                        onClick={() => onDeleteCard?.(card.id)}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        title="Eliminar carta"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
