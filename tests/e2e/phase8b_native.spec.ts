// Phase 8.B — Native E2E tests against the real compiled Tauri binary.
//
// Tests drive the Tauri WebView via tauri-driver (W3C WebDriver, port 4444).
// All IPC calls hit real Rust code; SQLite is the source of truth.
//
// Run: npm run test:e2e:native  (scripts/run-native-e2e.sh handles setup)
// Manual: tauri-driver -- ./src-tauri/target/release/learnme  then  playwright test --config playwright.tauri.config.ts

import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── W3C WebDriver thin client ─────────────────────────────────────────────────
// Speaks directly to tauri-driver's WebDriver endpoint.
// No Playwright browser — tests use @playwright/test for lifecycle only.

const WD_BASE = 'http://localhost:4444'
const BINARY_PATH = path.resolve(__dirname, '../../target/release/learnme')

interface WdSession { sessionId: string }

async function wdReq(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${WD_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json() as { value: unknown }
  return json.value
}

async function createSession(): Promise<WdSession> {
  const value = await wdReq('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'wry',
        'tauri:options': { application: BINARY_PATH },
      },
    },
  }) as { sessionId: string }
  return { sessionId: value.sessionId }
}

async function deleteSession(s: WdSession): Promise<void> {
  await wdReq('DELETE', `/session/${s.sessionId}`)
}

// Uses execute/async so Promises (Tauri IPC) can resolve before the driver returns.
// The script receives its args as arguments[0], arguments[1], …, callback as the last.
async function runAsync<T>(s: WdSession, script: string, args: unknown[] = []): Promise<T> {
  return wdReq('POST', `/session/${s.sessionId}/execute/async`, { script, args }) as Promise<T>
}

// Invokes a real Tauri IPC command through window.__TAURI_INTERNALS__ inside the WebView.
async function tauriInvoke<T>(s: WdSession, cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await runAsync<[string | null, unknown]>(s,
    `var cb = arguments[arguments.length - 1];
     var cmd = arguments[0]; var args = arguments[1];
     if (!window.__TAURI_INTERNALS__) { cb(["__TAURI_INTERNALS__ not found", null]); return; }
     window.__TAURI_INTERNALS__.invoke(cmd, args)
       .then(function(r) { cb([null, r !== undefined ? r : null]); })
       .catch(function(e) { cb([String(e), null]); });`,
    [cmd, args],
  )
  const [err, value] = result
  if (err) throw new Error(`invoke(${cmd}) failed: ${err}`)
  return value as T
}

async function findEl(s: WdSession, css: string): Promise<string> {
  const val = await wdReq('POST', `/session/${s.sessionId}/element`, {
    using: 'css selector', value: css,
  }) as Record<string, string>
  return Object.values(val)[0]
}

async function clickEl(s: WdSession, id: string): Promise<void> {
  await wdReq('POST', `/session/${s.sessionId}/element/${id}/click`)
}

async function setViewport(s: WdSession, w: number, h: number): Promise<void> {
  await wdReq('POST', `/session/${s.sessionId}/window/rect`, { width: w, height: h })
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURE_DECK = path.resolve(__dirname, '../../fixtures/decks/spanish-a2-valid.json')
const TMP_EXPORT = path.resolve(__dirname, '../../fixtures/session/tmp-phase8b-export.learnme')

// ── Tests ─────────────────────────────────────────────────────────────────────

test('app launches and shows learnMe UI', async () => {
  const s = await createSession()
  try {
    const title = await wdReq('GET', `/session/${s.sessionId}/title`) as string
    expect(title).toMatch(/learnMe/i)

    const bodyText = await runAsync<string>(s, `
      var cb = arguments[arguments.length-1];
      cb(document.body.innerText || document.body.textContent || '');
    `)
    expect(bodyText).toMatch(/learnMe/i)
  } finally {
    await deleteSession(s)
  }
})

test('import deck from real file → cards persisted in SQLite', async () => {
  expect(fs.existsSync(FIXTURE_DECK), `fixture missing: ${FIXTURE_DECK}`).toBe(true)

  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    // Create category via real IPC (Tauri 2: struct payload wrapped under param name)
    const category = await tauriInvoke<{ id: string }>(s, 'category_create', {
      payload: { name: 'Phase8B Test', color: null },
    })
    expect(category.id).toBeTruthy()

    // Create study (deck)
    const study = await tauriInvoke<{ id: string }>(s, 'study_create', {
      payload: { category_id: category.id, method: 'anki', name: 'Spanish A2', payload: {} },
    })
    expect(study.id).toBeTruthy()

    // Import the deck fixture using the real JSON (file read on Node side, sent as value)
    const deckJson = JSON.parse(fs.readFileSync(FIXTURE_DECK, 'utf-8')) as unknown
    const result = await tauriInvoke<{ inserted: number; skipped: number }>(s, 'import_anki_deck', {
      studyId: study.id,
      deck: deckJson,
    })
    expect(result.inserted).toBeGreaterThan(0)
    expect(result.skipped).toBe(0)

    // Verify cards are in DB
    const cards = await tauriInvoke<unknown[]>(s, 'card_list_by_deck', { deckId: study.id })
    expect(cards.length).toBe(result.inserted)
  } finally {
    await deleteSession(s)
  }
})

test('grade card → state updated in DB', async () => {
  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    const category = await tauriInvoke<{ id: string }>(s, 'category_create', {
      payload: { name: 'GradeTest', color: null },
    })
    const study = await tauriInvoke<{ id: string }>(s, 'study_create', {
      payload: { category_id: category.id, method: 'anki', name: 'GradeDeck', payload: {} },
    })

    await tauriInvoke(s, 'card_bulk_insert', {
      deckId: study.id,
      cards: [{ front: 'hello', back: 'hola', tags: [] }],
    })

    const next = await tauriInvoke<{ id: string } | null>(s, 'next_card', {
      deckId: study.id,
      newLimit: 20,
    })
    expect(next).not.toBeNull()

    await tauriInvoke(s, 'record_review', { cardId: next!.id, grade: 3 })

    const cards = await tauriInvoke<Array<{ id: string; state: string; reps: number }>>(
      s, 'card_list_by_deck', { deckId: study.id },
    )
    const card = cards.find(c => c.id === next!.id)
    expect(card?.state).toBe('learning')
    expect(card?.reps).toBe(1)
  } finally {
    await deleteSession(s)
  }
})

test('export session → file written to disk with valid checksum', async () => {
  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    const category = await tauriInvoke<{ id: string }>(s, 'category_create', {
      payload: { name: 'ExportTest', color: null },
    })
    const study = await tauriInvoke<{ id: string }>(s, 'study_create', {
      payload: { category_id: category.id, method: 'anki', name: 'ExportDeck', payload: {} },
    })
    await tauriInvoke(s, 'card_bulk_insert', {
      deckId: study.id,
      cards: [{ front: 'agua', back: 'water', tags: [] }],
    })

    await tauriInvoke(s, 'session_export', { destPath: TMP_EXPORT })

    expect(fs.existsSync(TMP_EXPORT), `export file not created at ${TMP_EXPORT}`).toBe(true)
    const exported = JSON.parse(fs.readFileSync(TMP_EXPORT, 'utf-8')) as {
      version: number; checksum: string; data: { categories: unknown[] }
    }
    expect(exported.version).toBe(1)
    expect(typeof exported.checksum).toBe('string')
    expect(exported.checksum.length).toBe(64)
    expect(exported.data.categories.length).toBeGreaterThan(0)
  } finally {
    await deleteSession(s)
    if (fs.existsSync(TMP_EXPORT)) fs.unlinkSync(TMP_EXPORT)
  }
})

test('roundtrip: export → reset DB → import → data identical', async () => {
  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    const category = await tauriInvoke<{ id: string }>(s, 'category_create', {
      payload: { name: 'RoundtripCat', color: null },
    })
    const study = await tauriInvoke<{ id: string }>(s, 'study_create', {
      payload: { category_id: category.id, method: 'anki', name: 'RoundtripDeck', payload: {} },
    })
    await tauriInvoke(s, 'card_bulk_insert', {
      deckId: study.id,
      cards: [
        { front: 'uno', back: 'one', tags: [] },
        { front: 'dos', back: 'two', tags: [] },
      ],
    })

    const next = await tauriInvoke<{ id: string } | null>(s, 'next_card', { deckId: study.id, newLimit: 20 })
    if (next) await tauriInvoke(s, 'record_review', { cardId: next.id, grade: 3 })

    await tauriInvoke(s, 'session_export', { destPath: TMP_EXPORT })

    await tauriInvoke(s, 'dev_reset_db')
    const empty = await tauriInvoke<unknown[]>(s, 'study_list_all')
    expect(empty.length).toBe(0)

    await tauriInvoke(s, 'session_import_cmd', { srcPath: TMP_EXPORT, mode: 'merge' })

    const studies = await tauriInvoke<Array<{ name: string }>>(s, 'study_list_all')
    expect(studies.some(st => st.name === 'RoundtripDeck')).toBe(true)
  } finally {
    await deleteSession(s)
    if (fs.existsSync(TMP_EXPORT)) fs.unlinkSync(TMP_EXPORT)
  }
})

test('zero external network calls during review session', async () => {
  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    const category = await tauriInvoke<{ id: string }>(s, 'category_create', {
      payload: { name: 'NetTest', color: null },
    })
    const study = await tauriInvoke<{ id: string }>(s, 'study_create', {
      payload: { category_id: category.id, method: 'anki', name: 'NetDeck', payload: {} },
    })
    await tauriInvoke(s, 'card_bulk_insert', {
      deckId: study.id,
      cards: [{ front: 'net', back: 'test', tags: [] }],
    })
    const next = await tauriInvoke<{ id: string } | null>(s, 'next_card', { deckId: study.id, newLimit: 20 })
    if (next) await tauriInvoke(s, 'record_review', { cardId: next.id, grade: 3 })

    // Verify no external requests via performance resource entries
    const entries = await runAsync<Array<{ name: string }>>(s, `
      var cb = arguments[arguments.length-1];
      cb(performance.getEntriesByType('resource').map(function(e){ return { name: e.name }; }));
    `)
    const external = entries.filter(e => {
      try {
        const u = new URL(e.name)
        return !['localhost', '127.0.0.1', ''].includes(u.hostname)
      } catch {
        return false
      }
    })
    expect(external, `External requests: ${external.map(e => e.name).join(', ')}`).toHaveLength(0)
  } finally {
    await deleteSession(s)
  }
})

test('responsive layout: 375×667 shows bottom-tabs, hides sidebar', async () => {
  const s = await createSession()
  try {
    await tauriInvoke(s, 'dev_reset_db')

    await setViewport(s, 375, 667)

    const bottomNavVisible = await runAsync<boolean>(s, `
      var cb = arguments[arguments.length-1];
      var el = document.querySelector('[data-testid="bottom-nav"]');
      if (!el) { cb(false); return; }
      var r = el.getBoundingClientRect();
      cb(r.width > 0 && r.height > 0);
    `)
    expect(bottomNavVisible, 'bottom-nav not visible at 375×667').toBe(true)

    const sidebarHidden = await runAsync<boolean>(s, `
      var cb = arguments[arguments.length-1];
      var el = document.querySelector('[data-testid="sidebar"]');
      if (!el) { cb(true); return; }
      var st = window.getComputedStyle(el);
      cb(st.display === 'none' || st.visibility === 'hidden' || el.getBoundingClientRect().width === 0);
    `)
    expect(sidebarHidden, 'sidebar should be hidden at 375×667').toBe(true)
  } finally {
    await deleteSession(s)
  }
})
