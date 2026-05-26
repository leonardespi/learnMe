import { ThemeToggle } from '@/shared/theme/ThemeToggle'
import { useAppStore } from '@/store/appStore'

const CATEGORIES_VIEWS = ['categories', 'category-detail', 'study-detail', 'review-session', 'stats']

export function Sidebar() {
  const navigateToCategories = useAppStore((s) => s.navigateToCategories)
  const navigateToSettings = useAppStore((s) => s.navigateToSettings)
  const view = useAppStore((s) => s.view)

  const catActive = CATEGORIES_VIEWS.includes(view.name)
  const settingsActive = view.name === 'settings'

  const itemBase =
    'flex items-center justify-between w-full text-left rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-100 cursor-pointer'
  const itemActive = 'text-[var(--text)]'
  const itemInactive = 'text-[var(--text-muted)] hover:text-[var(--text)]'

  return (
    <nav
      data-testid="sidebar"
      className="flex flex-col justify-between w-64 min-h-screen py-4 select-none"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      <div className="space-y-5 px-4">
        {/* Brand */}
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
            learnMe
          </span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--interactive)', color: 'var(--text-muted)' }}
          >
            v0.1
          </span>
        </div>

        {/* Nav */}
        <div className="space-y-0.5">
          <button
            onClick={navigateToCategories}
            className={`${itemBase} ${catActive ? itemActive : itemInactive}`}
            style={{ background: catActive ? 'var(--interactive)' : undefined }}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{
                  background: catActive ? 'var(--text)' : 'transparent',
                  border: catActive ? 'none' : '1px solid var(--text-muted)',
                }}
              />
              Categorías
            </span>
            <span className="hidden lg:inline font-mono text-[11px] text-[var(--text-muted)]">⌥1</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            FSRS v5
          </span>
          <ThemeToggle />
        </div>
        <button
          data-testid="btn-settings"
          onClick={navigateToSettings}
          className={`${itemBase} ${settingsActive ? itemActive : itemInactive}`}
          style={{ background: settingsActive ? 'var(--interactive)' : undefined }}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{
                background: settingsActive ? 'var(--text)' : 'transparent',
                border: settingsActive ? 'none' : '1px solid var(--text-muted)',
              }}
            />
            Ajustes
          </span>
          <span className="hidden lg:inline font-mono text-[11px] text-[var(--text-muted)]">⌥2</span>
        </button>
      </div>
    </nav>
  )
}
