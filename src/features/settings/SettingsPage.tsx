import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@/api/invoke'
import { SettingsView, SETTINGS_SECTIONS, type SettingsSectionId, ExportImportStatus } from './SettingsView'
import { useAppStore } from '@/store/appStore'
import { useTheme } from '@/shared/theme/useTheme'

const IN_TAURI = '__TAURI_INTERNALS__' in window

async function pickSavePath(): Promise<string | null> {
  if (IN_TAURI) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    return save({
      defaultPath: 'session.learnme',
      filters: [{ name: 'learnMe backup', extensions: ['learnme'] }],
    })
  }
  return '/tmp/learnme-session.learnme'
}

async function pickOpenPath(): Promise<string | null> {
  if (IN_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({
      filters: [{ name: 'learnMe backup', extensions: ['learnme'] }],
    })
    return Array.isArray(result) ? result[0] : result
  }
  return '/tmp/learnme-session.learnme'
}

export function SettingsPage() {
  const [exportStatus, setExportStatus] = useState<ExportImportStatus>('idle')
  const [importStatus, setImportStatus] = useState<ExportImportStatus>('idle')
  const [dailyNewLimit, setDailyNewLimitState] = useState(20)
  const navigateToCategories = useAppStore((s) => s.navigateToCategories)
  const settingsSection = useAppStore((s) => s.settingsSection)
  const setSettingsSection = useAppStore((s) => s.setSettingsSection)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    invoke<string | null>('settings_get', { key: 'daily_new_limit' })
      .then((v) => {
        const parsed = parseInt(v ?? '', 10)
        if (!isNaN(parsed) && parsed >= 1) setDailyNewLimitState(parsed)
      })
      .catch(() => {})
  }, [])

  const handleSetDailyNewLimit = useCallback((v: number) => {
    setDailyNewLimitState(v)
    invoke('settings_set', { key: 'daily_new_limit', value: String(v) }).catch(console.error)
  }, [])

  const handleExport = useCallback(async () => {
    try {
      const destPath = await pickSavePath()
      if (!destPath) return
      await invoke('session_export', { destPath })
      setExportStatus('success')
    } catch {
      setExportStatus('error')
    }
  }, [])

  const handleImport = useCallback(
    async (srcPath?: string, simulateError?: string) => {
      try {
        const resolvedPath = srcPath ?? (await pickOpenPath())
        if (!resolvedPath) return
        await invoke('session_import_cmd', {
          srcPath: resolvedPath,
          mode: 'merge',
          simulateError,
        })
        setImportStatus('success')
      } catch {
        setImportStatus('error')
      }
    },
    [],
  )

  useEffect(() => {
    const onMockImport = (e: Event) => {
      const { fixturePath, simulateError } = (
        e as CustomEvent<{ fixturePath: string; simulateError?: string }>
      ).detail
      handleImport(fixturePath, simulateError)
    }
    window.addEventListener('mock:session-import', onMockImport)
    return () => window.removeEventListener('mock:session-import', onMockImport)
  }, [handleImport])

  return (
    <div>
      {/* Back button — hidden on desktop (lg+), visible on mobile */}
      <div
        className="flex items-center px-8 py-3 lg:hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={navigateToCategories}
          className="font-mono text-xs transition-colors duration-100"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ← Volver
        </button>
      </div>

      {/* Mobile section dropdown — hidden on desktop (lg+) */}
      <div
        className="px-8 py-3 lg:hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <select
          value={settingsSection}
          onChange={(e) => setSettingsSection(e.target.value)}
          className="w-full text-sm font-medium rounded px-2 py-1.5 outline-none"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {SETTINGS_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <SettingsView
        exportStatus={exportStatus}
        importStatus={importStatus}
        onExport={handleExport}
        onImport={() => handleImport()}
        sectionId={settingsSection as SettingsSectionId}
        theme={theme}
        onSetTheme={setTheme}
        dailyNewLimit={dailyNewLimit}
        onSetDailyNewLimit={handleSetDailyNewLimit}
      />
    </div>
  )
}
