export type ExportImportStatus = 'idle' | 'success' | 'error'

export const SETTINGS_SECTIONS = [
  { id: 'backup', label: 'Copia de Seguridad' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'revision', label: 'Revisión' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

interface SettingsViewProps {
  exportStatus?: ExportImportStatus
  importStatus?: ExportImportStatus
  onExport?: () => void
  onImport?: () => void
  sectionId?: SettingsSectionId
  theme?: 'light' | 'dark'
  onSetTheme?: (t: 'light' | 'dark') => void
  dailyNewLimit?: number
  onSetDailyNewLimit?: (v: number) => void
}

export function SettingsView({
  exportStatus = 'idle',
  importStatus = 'idle',
  onExport,
  onImport,
  sectionId = 'backup',
  theme = 'light',
  onSetTheme,
  dailyNewLimit = 20,
  onSetDailyNewLimit,
}: SettingsViewProps) {
  return (
    <div
      data-testid="settings-view"
      className="max-w-xl mx-auto px-8 py-10 space-y-10"
    >
      {sectionId === 'backup' && (
        <section className="space-y-6">
          <h2
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Copia de seguridad
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="space-y-0.5">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  Exportar sesión
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Guarda todos tus mazos y progreso en un archivo.
                </p>
              </div>
              <button
                data-testid="btn-export-session"
                onClick={onExport}
                className="ml-8 text-xs font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Exportar
              </button>
            </div>

            {exportStatus !== 'idle' && (
              <p
                data-testid="export-status"
                className="font-mono text-xs"
                style={{ color: exportStatus === 'success' ? '#059669' : '#ef4444' }}
              >
                {exportStatus === 'success' ? 'Exportado correctamente.' : 'Error al exportar.'}
              </p>
            )}

            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="space-y-0.5">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  Importar sesión
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Restaura o fusiona mazos desde un archivo de respaldo.
                </p>
              </div>
              <button
                data-testid="btn-import-session"
                onClick={onImport}
                className="ml-8 text-xs font-medium px-3 py-1.5 rounded transition-colors duration-100 flex-shrink-0"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Importar
              </button>
            </div>

            {importStatus !== 'idle' && (
              <p
                data-testid="import-status"
                className="font-mono text-xs"
                style={{ color: importStatus === 'success' ? '#059669' : '#ef4444' }}
              >
                {importStatus === 'success' ? 'Importado correctamente.' : 'Error al importar.'}
              </p>
            )}
          </div>
        </section>
      )}

      {sectionId === 'apariencia' && (
        <section className="space-y-6">
          <h2
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Apariencia
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="space-y-0.5">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  Tema
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Elige entre modo claro u oscuro.
                </p>
              </div>
              <div className="flex items-center gap-1 ml-8 flex-shrink-0">
                {(['light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onSetTheme?.(t)}
                    className="text-xs font-medium px-3 py-1.5 rounded transition-colors duration-100"
                    style={
                      theme === t
                        ? { background: 'var(--text)', color: 'var(--bg)' }
                        : { color: 'var(--text-muted)', border: '1px solid var(--border)' }
                    }
                    onMouseEnter={(e) => { if (theme !== t) e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={(e) => { if (theme !== t) e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    {t === 'light' ? 'Claro' : 'Oscuro'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {sectionId === 'revision' && (
        <section className="space-y-6">
          <h2
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Revisión
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="space-y-0.5">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  Cartas nuevas por sesión
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Máximo de cartas nuevas introducidas en cada sesión.
                </p>
              </div>
              <input
                type="number"
                min={1}
                max={9999}
                value={dailyNewLimit}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1) onSetDailyNewLimit?.(v)
                }}
                className="ml-8 w-16 text-center text-sm font-medium rounded px-2 py-1.5 outline-none flex-shrink-0"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
