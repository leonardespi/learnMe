// Phase 7.5 unit tests — appStore extension for command palette state.
// These tests MUST FAIL (red) until appStore.ts is extended with
// commandPaletteOpen, openCommandPalette, closeCommandPalette in Step 4.
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store/appStore'

beforeEach(() => {
  useAppStore.setState({ view: { name: 'categories' } })
})

describe('appStore — command palette state (phase 7.5)', () => {
  it('phase7_5-1: initial commandPaletteOpen is false', () => {
    const state = useAppStore.getState() as unknown as Record<string, unknown>
    expect(state['commandPaletteOpen']).toBe(false)
  })

  it('phase7_5-2: openCommandPalette sets commandPaletteOpen to true', () => {
    const state = useAppStore.getState() as unknown as Record<string, unknown>
    const open = state['openCommandPalette'] as (() => void) | undefined
    expect(open, 'openCommandPalette must exist in store').toBeDefined()
    open!()
    expect((useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen']).toBe(true)
  })

  it('phase7_5-3: closeCommandPalette sets commandPaletteOpen to false', () => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
    const state = useAppStore.getState() as unknown as Record<string, unknown>
    const close = state['closeCommandPalette'] as (() => void) | undefined
    expect(close, 'closeCommandPalette must exist in store').toBeDefined()
    close!()
    expect((useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen']).toBe(false)
  })

  it('phase7_5-4: openCommandPalette is idempotent', () => {
    const open = (useAppStore.getState() as unknown as Record<string, unknown>)[
      'openCommandPalette'
    ] as (() => void) | undefined
    expect(open, 'openCommandPalette must exist').toBeDefined()
    open!()
    open!()
    expect((useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen']).toBe(true)
  })

  it('phase7_5-5: closeCommandPalette from false does not throw and stays false', () => {
    const close = (useAppStore.getState() as unknown as Record<string, unknown>)[
      'closeCommandPalette'
    ] as (() => void) | undefined
    expect(close, 'closeCommandPalette must exist').toBeDefined()
    expect(() => close!()).not.toThrow()
    expect((useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen']).toBe(false)
  })
})
