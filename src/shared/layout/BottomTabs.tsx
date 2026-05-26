import { useTheme } from '@/shared/theme/useTheme'
import { useAppStore } from '@/store/appStore'

const CATEGORIES_VIEWS = ['categories', 'category-detail', 'study-detail', 'review-session', 'stats']

export function BottomTabs() {
  const navigateToCategories = useAppStore((s) => s.navigateToCategories)
  const navigateToSettings = useAppStore((s) => s.navigateToSettings)
  const view = useAppStore((s) => s.view)
  const { theme, setTheme } = useTheme()

  const catActive = CATEGORIES_VIEWS.includes(view.name)
  const settingsActive = view.name === 'settings'

  const tabBase = 'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs rounded-md transition-colors duration-100'

  return (
    <nav
      data-testid="bottom-tabs"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 w-full"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div data-testid="bottom-nav" className="flex w-full items-center py-1">
      <button
        onClick={navigateToCategories}
        className={`${tabBase} ${catActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
      >
        <span className="text-xl leading-none">⊞</span>
        <span className="tracking-wide">Categorías</span>
      </button>

      <button
        data-testid="btn-settings"
        onClick={navigateToSettings}
        className={`${tabBase} ${settingsActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
      >
        <span className="text-xl leading-none">⚙</span>
        <span className="tracking-wide">Ajustes</span>
      </button>

      <button
        data-testid="theme-toggle"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className={`${tabBase} text-[var(--text-muted)]`}
      >
        <span className="text-xl leading-none">{theme === 'light' ? '◑' : '○'}</span>
        <span className="tracking-wide">Tema</span>
      </button>
      </div>
    </nav>
  )
}
