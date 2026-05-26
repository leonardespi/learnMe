import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { StudyDetail } from './StudyDetail'
import { useAppStore } from '@/store/appStore'
import type { Card, Study } from '@/types/domain'

// ─── Deck inspection panel (col3 for study-detail) ───────────────────────────

interface StudiesViewProps {
  studyId: string
  categoryId: string
}

export function StudiesView({ studyId, categoryId }: StudiesViewProps) {
  const navigateToCategoryDetail = useAppStore((s) => s.navigateToCategoryDetail)
  const navigateToReviewSession = useAppStore((s) => s.navigateToReviewSession)
  const navigateToStats = useAppStore((s) => s.navigateToStats)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // any-justified: E2E test hook, not called in production Tauri context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__CURRENT_STUDY_ID__ = studyId
    }
    return () => {
      if (typeof window !== 'undefined') {
        // any-justified: cleanup E2E hook
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__CURRENT_STUDY_ID__
      }
    }
  }, [studyId])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ['cards', studyId],
    queryFn: () => invoke('card_list_by_deck', { deckId: studyId }),
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text()
      const json = JSON.parse(content)
      return invoke('import_anki_deck', { studyId, deck: json })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', studyId] })
      setShowConfirm(false)
      setSelectedFile(null)
    },
    onError: console.error,
  })

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => invoke('card_delete', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards', studyId] }),
    onError: console.error,
  })

  const updateCardMutation = useMutation({
    mutationFn: ({ id, front, back, tags }: { id: string; front: string; back: string; tags: string[] }) =>
      invoke('card_update', { id, front, back, tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards', studyId] }),
    onError: console.error,
  })

  const handleImportClick = () => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setSelectedFile(file); setShowConfirm(true) }
  }

  return (
    <div data-testid="study-detail" className="px-6 py-8 space-y-6">
      {/* Action bar */}
      <div
        className="flex items-center justify-between pb-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigateToCategoryDetail(categoryId)}
          className="font-mono text-xs transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ← Volver
        </button>

        <div className="flex items-center gap-2">
          {/* Card state summary — compact badges */}
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: '#2563eb', background: 'rgba(219,234,254,0.6)' }}
          >
            {cards.filter((c) => c.state === 'new').length} new
          </span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: '#059669', background: 'rgba(209,250,229,0.6)' }}
          >
            {cards.filter((c) => c.state === 'review').length} due
          </span>

          <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />

          <button
            data-testid="btn-view-stats"
            onClick={() => navigateToStats(studyId, categoryId)}
            className="text-xs font-medium px-2.5 py-1 rounded transition-colors duration-100"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Estadísticas
          </button>
          <button
            data-testid="btn-start-review"
            onClick={() => navigateToReviewSession(studyId, categoryId)}
            className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Iniciar repaso
            <kbd className="font-mono text-[10px] opacity-50">Espacio</kbd>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-input-hidden"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {showConfirm && (
        <div
          className="flex items-center gap-3 py-3 px-4 rounded"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
            Importar{' '}
            <span className="font-mono text-xs">{selectedFile?.name}</span>?
          </p>
          <button
            data-testid="btn-confirm-import"
            onClick={() => selectedFile && importMutation.mutate(selectedFile)}
            className="text-xs font-medium px-3 py-1.5 rounded hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Confirmar
          </button>
          <button
            onClick={() => { setShowConfirm(false); setSelectedFile(null) }}
            className="text-xs px-3 py-1.5 rounded transition-colors duration-100"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Cancelar
          </button>
        </div>
      )}

      <StudyDetail
        cards={cards}
        onImport={handleImportClick}
        onAddCard={() => {/* Phase 5 */}}
        onDeleteCard={(id) => deleteCardMutation.mutate(id)}
        onUpdateCard={(id, front, back, tags) => updateCardMutation.mutate({ id, front, back, tags })}
      />
    </div>
  )
}

// ─── CategoryStudiesView (mobile + legacy) ────────────────────────────────────

interface CategoryStudiesViewProps {
  categoryId: string
}

export function CategoryStudiesView({ categoryId }: CategoryStudiesViewProps) {
  const navigateToStudyDetail = useAppStore((s) => s.navigateToStudyDetail)
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ['studies', categoryId],
    queryFn: () => invoke('study_list_by_category', { categoryId }),
  })

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      invoke('study_create', {
        payload: { category_id: categoryId, method: 'anki', name, payload: {} },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies', categoryId] })
      setShowForm(false)
      setNewName('')
    },
    onError: console.error,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke('study_delete', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studies', categoryId] }),
    onError: console.error,
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => invoke('study_update', { id, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies', categoryId] })
      setRenamingId(null)
      setRenameValue('')
    },
    onError: console.error,
  })

  const startRename = (study: Study) => {
    setRenamingId(study.id)
    setRenameValue(study.name)
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Estudios
        </h1>
        <button
          data-testid="btn-new-study"
          onClick={() => setShowForm(true)}
          className="text-xs font-medium transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          + Nuevo estudio
        </button>
      </div>

      {showForm && (
        <div
          className="flex items-center gap-3 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <input
            data-testid="input-study-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del estudio"
            className="flex-1 bg-transparent text-sm outline-none py-1 px-0"
            style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
            onKeyDown={(e) =>
              e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())
            }
            autoFocus
          />
          <button
            data-testid="btn-save-study"
            onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
            className="text-xs font-medium px-2 py-1 hover:opacity-70 flex-shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            Guardar
          </button>
          <button
            onClick={() => { setShowForm(false); setNewName('') }}
            className="text-xs px-2 py-1 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {studies.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
          No hay estudios todavía.
        </p>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {studies.map((study) => (
            <div
              key={study.id}
              data-testid="study-item"
              className="py-3 px-2 -mx-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {renamingId === study.id ? (
                <div className="flex items-center gap-2">
                  <input
                    data-testid="input-rename-deck"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none py-1"
                    style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
                    onKeyDown={(e) => e.key === 'Enter' && renameValue.trim() && renameMutation.mutate({ id: study.id, name: renameValue.trim() })}
                    autoFocus
                  />
                  <button
                    data-testid="btn-save-rename-deck"
                    onClick={() => renameValue.trim() && renameMutation.mutate({ id: study.id, name: renameValue.trim() })}
                    className="p-1 rounded flex-shrink-0 transition-colors duration-100 hover:opacity-80"
                    style={{ color: 'var(--accent)' }}
                    title="Guardar nombre"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="p-1 rounded flex-shrink-0 transition-colors duration-100"
                    style={{ color: 'var(--text-muted)' }}
                    title="Cancelar"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <span
                    className="text-sm font-medium flex-1 cursor-pointer"
                    style={{ color: 'var(--text)' }}
                    onClick={() => navigateToStudyDetail(study.id, categoryId)}
                  >
                    {study.name}
                  </span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <button
                      data-testid="btn-rename-deck"
                      onClick={(e) => { e.stopPropagation(); startRename(study) }}
                      className="p-1 rounded transition-colors duration-100"
                      style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      title="Renombrar mazo"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      data-testid="btn-delete-deck"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(study.id) }}
                      className="p-1 rounded transition-colors duration-100"
                      style={{ color: 'var(--text-muted)', opacity: 0.55 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      title="Eliminar mazo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
