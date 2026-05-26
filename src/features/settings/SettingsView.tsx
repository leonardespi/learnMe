export type ExportImportStatus = 'idle' | 'success' | 'error'

interface SettingsViewProps {
  exportStatus?: ExportImportStatus
  importStatus?: ExportImportStatus
  onExport?: () => void
  onImport?: () => void
}

export function SettingsView({
  exportStatus = 'idle',
  importStatus = 'idle',
  onExport,
  onImport,
}: SettingsViewProps) {
  return (
    <div
      data-testid="settings-view"
      className="max-w-xl mx-auto px-8 py-10 space-y-10"
    >
      <h1
        className="text-xl font-semibold tracking-tight"
        style={{ color: 'var(--text)' }}
      >
        Ajustes
      </h1>

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
    </div>
  )
}
