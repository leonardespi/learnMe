import { ThemeToggle } from '@/shared/theme/ThemeToggle'
import { useAppStore } from '@/store/appStore'

const CATEGORIES_VIEWS = ['categories', 'category-detail', 'study-detail', 'review-session', 'stats']

export function BottomTabs() {
  const navigateToCategories = useAppStore((s) => s.navigateToCategories)
  const navigateToSettings = useAppStore((s) => s.navigateToSettings)
  const view = useAppStore((s) => s.view)

  const catActive = CATEGORIES_VIEWS.includes(view.name)
  const settingsActive = view.name === 'settings'

  const tabBase = 'flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-100'

  return (
    <nav
      data-testid="bottom-tabs"
      className="flex md:hidden fixed bottom-0 left-0 right-0 h-14 z-50 items-stretch"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <button
        onClick={navigateToCategories}
        className={`${tabBase} ${catActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
      >
        <span className="font-mono text-base leading-none">⊞</span>
        <span className="font-mono text-[10px] tracking-wide">Categorías</span>
      </button>

      <button
        data-testid="btn-settings"
        onClick={navigateToSettings}
        className={`${tabBase} ${settingsActive ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}
      >
        <span className="font-mono text-base leading-none">⚙</span>
        <span className="font-mono text-[10px] tracking-wide">Ajustes</span>
      </button>

      <div className="flex-1 flex items-center justify-center">
        <ThemeToggle />
      </div>
    </nav>
  )
}
