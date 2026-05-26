// Phase 7.5 unit tests — CommandPalette component lifecycle, keyboard capture, filtering, navigation.
// These tests MUST FAIL (red) until src/features/command-palette/CommandPalette.tsx
// and the appStore extensions are implemented in Step 4.
//
// Import will throw MODULE_NOT_FOUND until the component file is created.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '@/store/appStore'

// FAILS TO IMPORT — component does not exist yet (RED)
import { CommandPalette } from '@/features/command-palette/CommandPalette'

const MOCK_STUDIES = [
  { id: 'study-1', categoryId: 'cat-1', name: 'Spanish A2', method: 'anki', payload: {}, createdAt: '', updatedAt: '' },
  { id: 'study-2', categoryId: 'cat-1', name: 'Japanese N5', method: 'anki', payload: {}, createdAt: '', updatedAt: '' },
  { id: 'study-3', categoryId: 'cat-1', name: 'English Idioms', method: 'anki', payload: {}, createdAt: '', updatedAt: '' },
]

function renderPalette() {
  return render(<CommandPalette studies={MOCK_STUDIES} />)
}

beforeEach(() => {
  useAppStore.setState({ view: { name: 'categories' } })
  const store = useAppStore.getState() as unknown as Record<string, unknown>
  if (typeof store['closeCommandPalette'] === 'function') {
    (store['closeCommandPalette'] as () => void)()
  }
})

// ── Rendering ──────────────────────────────────────────────────────────────────

describe('CommandPalette — rendering (phase 7.5)', () => {
  it('phase7_5-6: not visible when commandPaletteOpen is false', () => {
    renderPalette()
    const palette = screen.queryByTestId('command-palette')
    expect(palette).toBeNull()
  })

  it('phase7_5-7: visible when commandPaletteOpen is true', () => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
    renderPalette()
    expect(screen.getByTestId('command-palette')).toBeVisible()
  })

  it('phase7_5-8: input receives focus automatically when palette opens', () => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
    renderPalette()
    const input = screen.getByTestId('command-palette-input')
    expect(document.activeElement).toBe(input)
  })
})

// ── Keyboard capture ───────────────────────────────────────────────────────────

describe('CommandPalette — keyboard shortcuts (phase 7.5)', () => {
  it('phase7_5-9: Ctrl+K opens palette when closed', () => {
    renderPalette()
    fireEvent.keyDown(document, { ctrlKey: true, key: 'k' })
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(true)
  })

  it('phase7_5-10: Meta+K opens palette (macOS ⌘K)', () => {
    renderPalette()
    fireEvent.keyDown(document, { metaKey: true, key: 'k' })
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(true)
  })

  it('phase7_5-11: Escape closes palette when open', () => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
    renderPalette()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(false)
  })

  it('phase7_5-12: Ctrl+K does not close palette when already open', () => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
    renderPalette()
    fireEvent.keyDown(document, { ctrlKey: true, key: 'k' })
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(true)
  })

  it('phase7_5-13: plain k keydown does not open palette', () => {
    renderPalette()
    fireEvent.keyDown(document, { key: 'k' })
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(false)
  })
})

// ── Filtering ──────────────────────────────────────────────────────────────────

describe('CommandPalette — filtering (phase 7.5)', () => {
  beforeEach(() => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
  })

  it('phase7_5-14: empty query shows all 3 studies', async () => {
    renderPalette()
    const items = screen.getAllByTestId('palette-item')
    expect(items).toHaveLength(3)
  })

  it('phase7_5-15: "span" filters to 1 item: Spanish A2', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByTestId('command-palette-input'), 'span')
    const items = screen.getAllByTestId('palette-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Spanish A2')
  })

  it('phase7_5-16: "JAPANESE" filters case-insensitively to Japanese N5', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByTestId('command-palette-input'), 'JAPANESE')
    const items = screen.getAllByTestId('palette-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Japanese N5')
  })

  it('phase7_5-17: "zzz" shows empty state, no palette-item rendered', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByTestId('command-palette-input'), 'zzz')
    expect(screen.queryByTestId('palette-item')).toBeNull()
    expect(screen.getByTestId('palette-empty')).toBeVisible()
  })

  // CANNOT TEST: "English Idioms" contains no 'a'; correct filter result for query "a" is 2
  // items (Spanish A2, Japanese N5), not 3. Expected value in approved test data is wrong.
  // Fix requires changing MOCK_STUDIES fixture — deferred to user decision.
  it.skip('phase7_5-18: "a" matches all 3 names (Spanish, Japanese, English all contain "a")', async () => {
    const user = userEvent.setup()
    renderPalette()
    await user.type(screen.getByTestId('command-palette-input'), 'a')
    const items = screen.getAllByTestId('palette-item')
    expect(items).toHaveLength(3)
  })
})

// ── Navigation and close ───────────────────────────────────────────────────────

describe('CommandPalette — navigation (phase 7.5)', () => {
  beforeEach(() => {
    useAppStore.setState({ commandPaletteOpen: true } as never)
  })

  it('phase7_5-19: clicking a study item navigates and closes palette', async () => {
    const user = userEvent.setup()
    renderPalette()
    const items = screen.getAllByTestId('palette-item')
    const spanishItem = items.find((el) => el.textContent?.includes('Spanish A2'))
    expect(spanishItem).toBeDefined()
    await user.click(spanishItem!)
    const storeState = useAppStore.getState() as unknown as Record<string, unknown>
    expect(storeState['commandPaletteOpen']).toBe(false)
    const view = storeState['view'] as { name: string; studyId?: string }
    expect(view.name).toBe('study-detail')
    expect(view.studyId).toBe('study-1')
  })

  it('phase7_5-20: clicking outside the palette panel closes it without navigating', async () => {
    const user = userEvent.setup()
    renderPalette()
    const overlay = screen.getByTestId('command-palette')
    await user.click(overlay)
    expect(
      (useAppStore.getState() as unknown as Record<string, unknown>)['commandPaletteOpen'],
    ).toBe(false)
    const view = (useAppStore.getState() as unknown as Record<string, unknown>)['view'] as { name: string }
    expect(view.name).toBe('categories')
  })
})
