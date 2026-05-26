// Phase 4 — useTheme hook unit tests.
// MUST FAIL (red) until src/shared/theme/useTheme.ts is created.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '@/shared/theme/useTheme'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  delete document.documentElement.dataset['theme']
})

describe('useTheme', () => {
  // Test #23: default theme is "light" when no persisted value
  it('defaults to light theme when no stored value', async () => {
    const { result } = renderHook(() => useTheme())
    // allow async init to settle
    await act(async () => {})
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset['theme']).toBe('light')
  })

  // Test #24: setTheme("dark") updates DOM
  it('setTheme dark updates documentElement data-theme', async () => {
    const { result } = renderHook(() => useTheme())
    await act(async () => {})
    await act(async () => {
      result.current.setTheme('dark')
    })
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  // Test #25: setTheme("light") after dark reverts DOM
  it('setTheme light reverts documentElement data-theme', async () => {
    const { result } = renderHook(() => useTheme())
    await act(async () => {})
    await act(async () => {
      result.current.setTheme('dark')
    })
    await act(async () => {
      result.current.setTheme('light')
    })
    expect(document.documentElement.dataset['theme']).toBe('light')
  })
})
