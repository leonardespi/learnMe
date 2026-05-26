import { useState, useEffect } from 'react'
import { invoke } from '@/api/invoke'

export type Theme = 'light' | 'dark'

function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    applyTheme('light')
    invoke<string | null>('settings_get', { key: 'theme' })
      .then((stored) => {
        const t: Theme = stored === 'dark' ? 'dark' : 'light'
        setThemeState(t)
        applyTheme(t)
      })
      .catch(() => {
        applyTheme('light')
      })
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    invoke('settings_set', { key: 'theme', value: t }).catch(console.error)
  }

  return { theme, setTheme }
}
