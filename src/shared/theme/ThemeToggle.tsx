import { useTheme } from './useTheme'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'

  return (
    <span data-testid="theme-toggle">
      <button
        data-testid="btn-theme-toggle"
        aria-label={`Switch to ${next} theme`}
        onClick={() => setTheme(next)}
        className="p-1.5 rounded-md font-mono text-sm leading-none transition-colors duration-100"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {theme === 'light' ? '◑' : '○'}
      </button>
    </span>
  )
}
