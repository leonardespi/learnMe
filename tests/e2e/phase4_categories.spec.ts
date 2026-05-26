// Phase 4 E2E tests — categories, import, layout, theme persistence.
// MUST FAIL (red) until UI components are implemented in step 4.
// File dialog strategy: hidden <input data-testid="file-input-hidden"> bypasses native OS dialog.
import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DECK = path.resolve(__dirname, '../../fixtures/decks/spanish-a2-valid.json')

async function createCategory(page: Page, name: string) {
  await page.click('[data-testid="btn-new-category"]')
  await page.fill('[data-testid="input-category-name"]', name)
  await page.click('[data-testid="btn-save-category"]')
}

// ── Test: Create category and verify in list ─────────────────────────────────

test('create category appears in list', async ({ page }) => {
  await page.goto('/')
  await createCategory(page, 'Idiomas')
  await expect(page.locator('[data-testid="category-item"]').filter({ hasText: 'Idiomas' })).toBeVisible()
})

// ── Test: Import deck and see cards ─────────────────────────────────────────

test('import deck shows cards in study detail', async ({ page }) => {
  await page.goto('/')
  await createCategory(page, 'Test')

  // Navigate to the category and create a study
  await page.click('[data-testid="category-item"]')
  await page.click('[data-testid="btn-new-study"]')
  await page.fill('[data-testid="input-study-name"]', 'Spanish A2')
  await page.click('[data-testid="btn-save-study"]')

  // Navigate into the study detail
  await page.click('[data-testid="study-item"]')

  // Use hidden file input to bypass native OS dialog
  await page.setInputFiles('input[data-testid="file-input-hidden"]', FIXTURE_DECK)
  await page.click('[data-testid="btn-confirm-import"]')

  await expect(page.locator('[data-testid="card-item"]').first()).toBeVisible({ timeout: 10_000 })
})

// ── Test: Responsive layout — bottom-tabs on mobile ─────────────────────────

test('shows bottom-tabs on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  await expect(page.locator('[data-testid="bottom-tabs"]')).toBeVisible()
  await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
})

// ── Test: Responsive layout — sidebar on desktop ─────────────────────────────

test('shows sidebar on desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
  await expect(page.locator('[data-testid="bottom-tabs"]')).not.toBeVisible()
})

// ── Test: Theme toggle persists on reload ────────────────────────────────────

test('dark theme persists after page reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  await page.click('[data-testid="btn-theme-toggle"]')
  const themeAfterToggle = await page.evaluate(
    () => document.documentElement.dataset['theme']
  )
  expect(themeAfterToggle).toBe('dark')

  await page.reload()

  const themeAfterReload = await page.evaluate(
    () => document.documentElement.dataset['theme']
  )
  expect(themeAfterReload).toBe('dark')
})

// ── Snapshots (visual; require human approval in exit gate) ─────────────────

test('visual snapshot — home light', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page).toHaveScreenshot('snapshot-home-light.png', { maxDiffPixelRatio: 0.1 })
})

test('visual snapshot — home dark', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.click('[data-testid="btn-theme-toggle"]')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page).toHaveScreenshot('snapshot-home-dark.png', { maxDiffPixelRatio: 0.1 })
})

test('visual snapshot — categories list light', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await createCategory(page, 'Idiomas')
  await expect(page).toHaveScreenshot('snapshot-categories-light.png', { maxDiffPixelRatio: 0.1 })
})

test('visual snapshot — study detail with cards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await createCategory(page, 'Test')
  await page.click('[data-testid="category-item"]')
  await page.click('[data-testid="btn-new-study"]')
  await page.fill('[data-testid="input-study-name"]', 'Spanish A2')
  await page.click('[data-testid="btn-save-study"]')
  await page.click('[data-testid="study-item"]')
  await page.setInputFiles('input[data-testid="file-input-hidden"]', FIXTURE_DECK)
  await page.click('[data-testid="btn-confirm-import"]')
  await page.locator('[data-testid="card-item"]').first().waitFor({ timeout: 10_000 })
  await expect(page).toHaveScreenshot('snapshot-study-detail-light.png', { maxDiffPixelRatio: 0.1 })
})
