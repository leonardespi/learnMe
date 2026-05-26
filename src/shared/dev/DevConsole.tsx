import { useEffect, useRef, useState } from 'react'

type Level = 'error' | 'warn' | 'ipc-call' | 'ipc-ok' | 'ipc-err'

interface LogEntry {
  id: number
  level: Level
  msg: string
  ts: string
}

let seq = 0
const listeners = new Set<(entry: LogEntry) => void>()

function push(level: Level, args: unknown[]) {
  const msg = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a) } catch { return String(a) }
      }
      return String(a)
    })
    .join(' ')
  listeners.forEach((fn) => fn({ id: ++seq, level, msg, ts: new Date().toLocaleTimeString('en', { hour12: false }) }))
}

// Patch console once at module load
const _origError = console.error
const _origWarn  = console.warn
const _origInfo  = console.info
console.error = (...args) => { _origError(...args); push('error', args) }
console.warn  = (...args) => { _origWarn(...args);  push('warn',  args) }
console.info  = (...args) => {
  _origInfo(...args)
  const first = String(args[0] ?? '')
  if (first.startsWith('[IPC →]'))   push('ipc-call', args)
  else if (first.startsWith('[IPC ✓]')) push('ipc-ok', args)
  else if (first.startsWith('[IPC ❌]')) push('ipc-err', args)
  // ignore non-IPC info to avoid noise
}

const STYLE: Record<Level, { badge: string; bg: string; label: string }> = {
  'error':    { badge: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'ERR'  },
  'warn':     { badge: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'WARN' },
  'ipc-call': { badge: '#22d3ee', bg: 'rgba(34,211,238,0.05)',  label: '→'    },
  'ipc-ok':   { badge: '#4ade80', bg: 'rgba(74,222,128,0.05)',  label: '✓'    },
  'ipc-err':  { badge: '#f87171', bg: 'rgba(248,113,113,0.08)', label: '❌'   },
}

const isError = (l: Level) => l === 'error' || l === 'ipc-err'

export function DevConsole() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [open, setOpen]       = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const add = (e: LogEntry) => {
      setEntries((prev) => [...prev.slice(-199), e])
      if (isError(e.level)) setErrorCount((n) => n + 1)
    }
    listeners.add(add)

    const onUnhandled = (ev: PromiseRejectionEvent) =>
      push('error', [`[Promise] ${ev.reason}`])
    const onWindowError = (ev: ErrorEvent) =>
      push('error', [`[Window] ${ev.message} (${ev.filename}:${ev.lineno})`])

    window.addEventListener('unhandledrejection', onUnhandled)
    window.addEventListener('error', onWindowError)
    return () => {
      listeners.delete(add)
      window.removeEventListener('unhandledrejection', onUnhandled)
      window.removeEventListener('error', onWindowError)
    }
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, open])

  const clear = () => { setEntries([]); setErrorCount(0) }
  const ipcCount = entries.filter((e) => e.level === 'ipc-call').length

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, fontFamily: 'monospace', fontSize: 11 }}>
      {/* Toggle bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 10px', background: '#18181b',
          borderTop: '1px solid #3f3f46', cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => { setOpen((v) => !v); if (!open) setErrorCount(0) }}
      >
        <span style={{ color: '#71717a' }}>DEV</span>

        {errorCount > 0 && (
          <span style={{ background: '#ef4444', color: '#fff', borderRadius: 9, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>
            {errorCount} err
          </span>
        )}
        {ipcCount > 0 && (
          <span style={{ background: '#164e63', color: '#22d3ee', borderRadius: 9, padding: '0 6px', fontSize: 10 }}>
            {ipcCount} ipc
          </span>
        )}

        <span style={{ color: '#52525b', marginLeft: 'auto' }}>
          {open ? '▼' : '▲'} {entries.length} entries
        </span>
        {entries.length > 0 && (
          <span
            style={{ color: '#52525b', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); clear() }}
          >
            clear
          </span>
        )}
      </div>

      {/* Log panel */}
      {open && (
        <div style={{ maxHeight: 260, overflowY: 'auto', background: '#09090b', borderTop: '1px solid #27272a' }}>
          {entries.length === 0
            ? <div style={{ color: '#52525b', padding: '8px 12px' }}>No logs yet.</div>
            : entries.map((e) => {
                const s = STYLE[e.level]
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', gap: 8, padding: '2px 12px',
                      background: s.bg, borderBottom: '1px solid #111113',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}
                  >
                    <span style={{ color: '#3f3f46', flexShrink: 0 }}>{e.ts}</span>
                    <span style={{ color: s.badge, fontWeight: 700, flexShrink: 0, width: 28, textAlign: 'center' }}>
                      {s.label}
                    </span>
                    <span style={{ color: '#d4d4d8' }}>{e.msg}</span>
                  </div>
                )
              })
          }
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
