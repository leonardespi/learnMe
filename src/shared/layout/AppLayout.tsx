import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@/api/invoke'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomTabs } from './BottomTabs'
import { CategoriesView } from '@/features/categories/CategoriesView'
import { CategoryStudiesView, StudiesView } from '@/features/studies/StudiesView'
import { ReviewSession } from '@/features/methods/anki/ReviewSession'
import { StatsPage } from '@/features/stats/StatsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/features/settings/SettingsView'
import { CommandPalette } from '@/features/command-palette/CommandPalette'
import { useAppStore } from '@/store/appStore'
import { useTheme } from '@/shared/theme/useTheme'
import { useEffect } from 'react'
import type { Category, Study, StudyMethod } from '@/types/domain'

// ─── Global header (spans col2 + col3) ───────────────────────────────────────

function GlobalHeader() {
  const view = useAppStore((s) => s.view)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)
  if (view.name === 'review-session') return null

  return (
    <header
      className="flex h-11 items-center justify-between px-5 flex-shrink-0 select-none"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
        learnMe
      </span>
      <button
        onClick={openCommandPalette}
        className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-1 text-xs transition-colors duration-100"
        style={{
          maxWidth: 200,
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <span>Buscar comando...</span>
        <kbd className="font-mono text-[10px]">⌘K</kbd>
      </button>
    </header>
  )
}

// ─── Col2 compact list panels ─────────────────────────────────────────────────

function CategoryListCol2() {
  const navigate = useAppStore((s) => s.navigateToCategoryDetail)
  const view = useAppStore((s) => s.view)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const queryClient = useQueryClient()

  const { data: cats = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => invoke('category_list'),
  })

  const create = useMutation({
    mutationFn: (n: string) => invoke('category_create', { payload: { name: n, color: null } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setShowForm(false); setName('') },
    onError: console.error,
  })

  const rename = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) =>
      invoke('category_update', { id, name: n, color: null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setRenamingId(null) },
    onError: console.error,
  })

  const remove = useMutation({
    mutationFn: (id: string) => invoke('category_delete', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: console.error,
  })

  const commitRename = (id: string) => {
    if (renameValue.trim()) rename.mutate({ id, n: renameValue.trim() })
    else setRenamingId(null)
  }

  const activeCategoryId = 'categoryId' in view ? view.categoryId : undefined

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 select-none"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Categorías
        </span>
        <button
          data-testid="btn-new-category"
          onClick={() => setShowForm((v) => !v)}
          className="font-mono text-[10px] transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          + Nuevo
        </button>
      </div>

      {showForm && (
        <div
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <input
            data-testid="input-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre..."
            autoFocus
            className="flex-1 bg-transparent text-xs outline-none py-0.5"
            style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate(name.trim())}
          />
          <button
            data-testid="btn-save-category"
            onClick={() => name.trim() && create.mutate(name.trim())}
            className="p-1 rounded flex-shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setShowForm(false); setName('') }}
            className="p-1 rounded flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {cats.length === 0 ? (
          <p className="px-4 py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Sin categorías todavía.
          </p>
        ) : (
          cats.map((cat) => {
            const isActive = cat.id === activeCategoryId
            const isRenaming = renamingId === cat.id
            return (
              <div
                key={cat.id}
                data-testid="category-item"
                onClick={() => !isRenaming && navigate(cat.id)}
                className="group flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors duration-75"
                style={{ background: isActive ? 'var(--interactive)' : undefined }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--interactive-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {isRenaming ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 bg-transparent text-xs outline-none py-0.5"
                      style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); commitRename(cat.id) }
                        if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
                      }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); commitRename(cat.id) }}
                      className="p-1 rounded flex-shrink-0"
                      style={{ color: 'var(--accent)' }}
                      title="Guardar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(null) }}
                      className="p-1 rounded flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: cat.color ?? 'var(--text-muted)' }}
                    />
                    <span className="text-sm truncate flex-1" style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', fontWeight: isActive ? 500 : 400 }}>
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(cat.id); setRenameValue(cat.name) }}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Renombrar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove.mutate(cat.id) }}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const METHOD_TAG: Record<string, { background: string; color: string }> = {
  anki: { background: '#7c3aed', color: '#ffffff' },
}
const DEFAULT_TAG = { background: '#6b7280', color: '#ffffff' }

function StudiesListCol2({ categoryId }: { categoryId: string }) {
  const navigateToStudyDetail = useAppStore((s) => s.navigateToStudyDetail)
  const view = useAppStore((s) => s.view)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [method, setMethod] = useState<StudyMethod>('anki')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const queryClient = useQueryClient()

  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ['studies', categoryId],
    queryFn: () => invoke('study_list_by_category', { categoryId }),
  })

  const create = useMutation({
    mutationFn: ({ name: n, method: m }: { name: string; method: StudyMethod }) =>
      invoke('study_create', { payload: { category_id: categoryId, method: m, name: n, payload: {} } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studies', categoryId] }); setShowForm(false); setName(''); setMethod('anki') },
    onError: console.error,
  })

  const rename = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => invoke('study_update', { id, name: n }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['studies', categoryId] }); setRenamingId(null) },
    onError: console.error,
  })

  const remove = useMutation({
    mutationFn: (id: string) => invoke('study_delete', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studies', categoryId] }),
    onError: console.error,
  })

  const commitRename = (id: string) => {
    if (renameValue.trim()) rename.mutate({ id, n: renameValue.trim() })
    else setRenamingId(null)
  }

  const selectedStudyId = 'studyId' in view ? view.studyId : undefined

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 select-none"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Estudios
        </span>
        <button
          data-testid="btn-new-study"
          onClick={() => setShowForm((v) => !v)}
          className="font-mono text-[10px] transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          + Nuevo
        </button>
      </div>

      {showForm && (
        <div
          className="flex flex-col gap-1.5 px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2">
            <input
              data-testid="input-study-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre..."
              autoFocus
              className="flex-1 bg-transparent text-xs outline-none py-0.5"
              style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate({ name: name.trim(), method })}
            />
            <button
              data-testid="btn-save-study"
              onClick={() => name.trim() && create.mutate({ name: name.trim(), method })}
              className="p-1 rounded flex-shrink-0"
              style={{ color: 'var(--accent)' }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setShowForm(false); setName(''); setMethod('anki') }}
              className="p-1 rounded flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            {(['anki'] as StudyMethod[]).map((m) => (
              <button
                key={m}
                data-testid={`method-tag-${m}`}
                onClick={() => setMethod(m)}
                className="font-mono text-[10px] px-2 py-0.5 rounded-full transition-colors duration-100"
                style={{
                  color: method === m ? 'var(--bg)' : 'var(--text-muted)',
                  background: method === m ? 'var(--accent)' : 'transparent',
                  border: `1px solid ${method === m ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {studies.length === 0 ? (
          <p className="px-4 py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Sin estudios todavía.
          </p>
        ) : (
          studies.map((study) => {
            const isActive = study.id === selectedStudyId
            const isRenaming = renamingId === study.id
            return (
              <div
                key={study.id}
                data-testid="study-item"
                onClick={() => !isRenaming && navigateToStudyDetail(study.id, categoryId)}
                className="group flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors duration-75"
                style={{ background: isActive ? 'var(--interactive)' : undefined }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--interactive-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {isRenaming ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 bg-transparent text-xs outline-none py-0.5"
                      style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); commitRename(study.id) }
                        if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
                      }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); commitRename(study.id) }}
                      className="p-1 rounded flex-shrink-0"
                      style={{ color: 'var(--accent)' }}
                      title="Guardar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(null) }}
                      className="p-1 rounded flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: isActive ? 'var(--accent)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.4 }}
                    />
                    <span
                      className="text-sm truncate flex-1"
                      style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', fontWeight: isActive ? 500 : 400 }}
                    >
                      {study.name}
                    </span>
                    <span
                      className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={METHOD_TAG[study.method] ?? DEFAULT_TAG}
                    >
                      {study.method}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(study.id); setRenameValue(study.name) }}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Renombrar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove.mutate(study.id) }}
                        className="p-1 rounded transition-colors duration-100"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Welcome / empty states for col3 ─────────────────────────────────────────

function WelcomeInspection() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <span className="font-mono text-2xl" style={{ color: 'var(--border)' }}>◫</span>
      <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        Selecciona un ítem para inspeccionarlo
      </p>
    </div>
  )
}

// ─── Col2 settings nav ────────────────────────────────────────────────────────

function SettingsNavCol2() {
  const settingsSection = useAppStore((s) => s.settingsSection)
  const setSettingsSection = useAppStore((s) => s.setSettingsSection)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {SETTINGS_SECTIONS.map((section) => {
          const isActive = settingsSection === section.id
          return (
            <div
              key={section.id}
              onClick={() => setSettingsSection(section.id as SettingsSectionId)}
              className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors duration-75"
              style={{ background: isActive ? 'var(--interactive)' : undefined }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--interactive-hover)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span
                className="text-sm truncate"
                style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', fontWeight: isActive ? 500 : 400 }}
              >
                {section.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Col2 list router ─────────────────────────────────────────────────────────

function ListPanelContent() {
  const view = useAppStore((s) => s.view)

  if (view.name === 'categories') return <CategoryListCol2 />
  if (view.name === 'category-detail') return <StudiesListCol2 categoryId={view.categoryId} />
  if (view.name === 'study-detail' || view.name === 'stats')
    return <StudiesListCol2 categoryId={view.categoryId} />
  if (view.name === 'settings') return <SettingsNavCol2 />
  return null
}

// ─── Col3 inspection router ───────────────────────────────────────────────────

function InspectionContent() {
  const view = useAppStore((s) => s.view)
  const navigateToCategoryDetail = useAppStore((s) => s.navigateToCategoryDetail)

  if (view.name === 'categories' || view.name === 'category-detail')
    return <WelcomeInspection />
  if (view.name === 'study-detail')
    return <StudiesView studyId={view.studyId} categoryId={view.categoryId} />
  if (view.name === 'stats')
    return <StatsPage studyId={view.studyId} categoryId={view.categoryId} />
  if (view.name === 'settings')
    return <SettingsPage />
  if (view.name === 'review-session')
    return (
      <ReviewSession
        deckId={view.studyId}
        onExit={() => navigateToCategoryDetail(view.categoryId)}
      />
    )
  return null
}

// ─── Mobile single-column router ──────────────────────────────────────────────

function MobileContent() {
  const view = useAppStore((s) => s.view)
  const navigateToCategoryDetail = useAppStore((s) => s.navigateToCategoryDetail)

  if (view.name === 'categories') return <CategoriesView />
  if (view.name === 'category-detail') return <CategoryStudiesView categoryId={view.categoryId} />
  if (view.name === 'study-detail')
    return <StudiesView studyId={view.studyId} categoryId={view.categoryId} />
  if (view.name === 'review-session')
    return (
      <ReviewSession
        deckId={view.studyId}
        onExit={() => navigateToCategoryDetail(view.categoryId)}
      />
    )
  if (view.name === 'stats')
    return <StatsPage studyId={view.studyId} categoryId={view.categoryId} />
  if (view.name === 'settings') return <SettingsPage />
  return null
}

// ─── Media-query hook — avoids rendering both layouts simultaneously ───────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export function AppLayout() {
  useTheme()
  const isDesktop = useIsDesktop()
  const view = useAppStore((s) => s.view)
  const navigateToCategories = useAppStore((s) => s.navigateToCategories)
  const navigateToSettings = useAppStore((s) => s.navigateToSettings)
  const isZenMode = view.name === 'review-session'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') { e.preventDefault(); navigateToCategories() }
      if (e.altKey && e.key === '2') { e.preventDefault(); navigateToSettings() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigateToCategories, navigateToSettings])

  const { data: allStudies = [] } = useQuery<Study[]>({
    queryKey: ['all-studies'],
    queryFn: () => invoke('study_list_all'),
    staleTime: 30_000,
  })

  return (
    <>
      {isDesktop ? (
        /* ── Desktop: fixed 3-column panel layout ── */
        <div
          className="hidden lg:flex h-screen overflow-hidden"
          style={{ background: 'var(--bg)' }}
        >
          {/* Col 1: Sidebar — fixed w-64, collapses in zen mode */}
          <div
            className="flex-shrink-0 overflow-hidden transition-all duration-150"
            style={{ width: isZenMode ? 0 : 256 }}
          >
            <Sidebar />
          </div>

          {/* Col 2+3 wrapper: shared GlobalHeader + row of panels */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <GlobalHeader />

            <div className="flex-1 flex overflow-hidden">
              {/* Col 2: List panel — fixed w-[480px], hidden in zen mode */}
              {!isZenMode && (
                <div
                  className="flex-shrink-0 flex flex-col overflow-hidden"
                  style={{ width: 480, borderRight: '1px solid var(--border)' }}
                >
                  <ListPanelContent />
                </div>
              )}

              {/* Col 3: Inspection panel — takes all remaining space */}
              <div className={`flex-1 min-w-0 ${isZenMode ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
                <InspectionContent />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Mobile: single-column with bottom tabs ── */
        <div
          className="flex lg:hidden min-h-screen flex-col w-full"
          style={{ background: 'var(--bg)' }}
        >
          <GlobalHeader />
          <main className="flex-1 overflow-y-auto pb-14">
            <MobileContent />
          </main>
        </div>
      )}

      <BottomTabs />
      <CommandPalette studies={allStudies} />
    </>
  )
}
