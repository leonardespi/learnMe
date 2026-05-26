// Phase 7 unit tests — SettingsView render.
// Imports from @/features/settings/SettingsView which does not exist yet.
// MUST fail (red) until production code is written.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsView } from '@/features/settings/SettingsView'

describe('SettingsView — render', () => {
  it('T27: renders export session button', () => {
    render(<SettingsView />)
    expect(screen.getByTestId('btn-export-session')).toBeInTheDocument()
  })

  it('T28: renders import session button', () => {
    render(<SettingsView />)
    expect(screen.getByTestId('btn-import-session')).toBeInTheDocument()
  })

  it('T29: shows success feedback when exportStatus is success', () => {
    render(<SettingsView exportStatus="success" />)
    const el = screen.getByTestId('export-status')
    expect(el.textContent).toMatch(/exportado/i)
  })

  it('T30: shows error feedback when exportStatus is error', () => {
    render(<SettingsView exportStatus="error" />)
    const el = screen.getByTestId('export-status')
    expect(el.textContent).toMatch(/error/i)
  })
})
