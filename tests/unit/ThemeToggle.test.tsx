// Phase 4 — ThemeToggle component unit tests.
// MUST FAIL (red) until src/shared/theme/ThemeToggle.tsx is created.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '@/shared/theme/ThemeToggle'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/shared/theme/useTheme', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
  })),
}))

import { useTheme } from '@/shared/theme/useTheme'

beforeEach(() => {
  document.documentElement.dataset['theme'] = 'light'
  vi.clearAllMocks()
})

describe('ThemeToggle', () => {
  // Test #26: button aria-label indicates next theme (dark) when current is light
  it('aria-label contains "dark" when current theme is light', () => {
    vi.mocked(useTheme).mockReturnValue({ theme: 'light', setTheme: vi.fn() })
    render(<ThemeToggle />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toMatch(/dark/i)
  })

  // Test #27: click calls setTheme("dark") → updates DOM
  it('click toggles theme from light to dark', () => {
    const setTheme = vi.fn((t: string) => {
      document.documentElement.dataset['theme'] = t
    })
    vi.mocked(useTheme).mockReturnValue({ theme: 'light', setTheme })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })
})
