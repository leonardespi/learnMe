import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import type { Study } from '@/types/domain'

interface Props {
  studies: Study[]
}

export function CommandPalette({ studies }: Props) {
  const open = useAppStore((s) => s.commandPaletteOpen)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        useAppStore.getState().openCommandPalette()
        return
      }
      if (e.key === 'Escape') {
        useAppStore.getState().closeCommandPalette()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  const filtered = query
    ? studies.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : studies

  const handleItemClick = (study: Study) => {
    useAppStore.getState().navigateToStudyDetail(study.id, study.categoryId)
    useAppStore.getState().closeCommandPalette()
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      useAppStore.getState().closeCommandPalette()
    }
  }

  return (
    <div
      data-testid="command-palette"
      onClick={handleOverlayClick}
      className="fixed inset-0 flex items-start justify-center pt-24 z-[9999]"
      style={{ background: 'rgba(0,0,0,0.25)' }}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-lg"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* Input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>⌘</span>
          <input
            ref={inputRef}
            autoFocus
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar mazos..."
            className="flex-1 bg-transparent py-3.5 text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          <kbd
            className="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              color: 'var(--text-muted)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div
            data-testid="palette-empty"
            className="py-8 text-center font-mono text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Sin resultados
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filtered.map((study) => (
              <li
                key={study.id}
                data-testid="palette-item"
                onClick={() => handleItemClick(study)}
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors duration-75"
                style={{ color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--interactive)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-sm">{study.name}</span>
                <span
                  className="font-mono text-[10px] ml-4 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  mazo
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2"
          style={{
            borderTop: '1px solid var(--border)',
          }}
        >
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            ↵ abrir · Esc cerrar
          </span>
        </div>
      </div>
    </div>
  )
}
