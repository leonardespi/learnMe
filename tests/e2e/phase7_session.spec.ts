// Phase 7 E2E tests — session export/import UI in Settings view.
// Requires SettingsView, btn-settings nav, session_export/session_import in mock-ipc.
// MUST fail (red) until production code is written in step 4.
import { test, expect } from '@playwright/test'
import * as path from 'path'

test.describe('Phase 7 — Session Export/Import E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__MOCK_RESET__ = true
    })
    await page.goto('/')
    await page.waitForSelector('[data-testid="categories-view"]')
  })

  async function navigateToSettings(page: import('@playwright/test').Page) {
    await page.click('[data-testid="btn-settings"]')
    await page.waitForSelector('[data-testid="settings-view"]')
  }

  // ── E2E-1: Export session ─────────────────────────────────────────────────

  test('E2E-1: export session button triggers export and shows success feedback', async ({
    page,
  }) => {
    await navigateToSettings(page)

    // mock-ipc handles session_export by returning success
    await page.click('[data-testid="btn-export-session"]')

    const status = page.getByTestId('export-status')
    await expect(status).toBeVisible({ timeout: 3000 })
    await expect(status).toContainText(/exportado|success/i)

    await page.screenshot({
      path: path.join('tests', 'e2e', 'snapshots', 'phase7-settings-export-success.png'),
    })
  })

  // ── E2E-2: Import session ─────────────────────────────────────────────────

  test('E2E-2: import session button triggers import and shows success feedback', async ({
    page,
  }) => {
    await navigateToSettings(page)

    // trigger mock import via mock:session-import event (mock-ipc reads valid-session fixture)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('mock:session-import', {
          detail: { fixturePath: '/fixtures/session/valid-session.learnme' },
        }),
      )
    })

    const status = page.getByTestId('import-status')
    await expect(status).toBeVisible({ timeout: 3000 })
    await expect(status).toContainText(/importado|success/i)

    await page.screenshot({
      path: path.join('tests', 'e2e', 'snapshots', 'phase7-settings-import-success.png'),
    })
  })

  // ── E2E-3: Import with corrupted checksum → error feedback ────────────────

  test('E2E-3: import with checksum error shows error feedback', async ({ page }) => {
    await navigateToSettings(page)

    // trigger mock import with corrupted fixture (mock-ipc returns ChecksumMismatch error)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('mock:session-import', {
          detail: {
            fixturePath: '/fixtures/session/corrupted-checksum.learnme',
            simulateError: 'ChecksumMismatch',
          },
        }),
      )
    })

    const status = page.getByTestId('import-status')
    await expect(status).toBeVisible({ timeout: 3000 })
    await expect(status).toContainText(/error|checksum/i)
  })
})
