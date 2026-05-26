// Phase 7.5 E2E tests — CommandPalette (⌘K) full flow in the running app.
// These tests MUST FAIL (red) until the CommandPalette component is rendered in the app (Step 4).
import { test, expect } from '@playwright/test'

test.describe('Phase 7.5 — Command Palette (⌘K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Seed one study in the mock state so palette has items to show
      ;(window as unknown as Record<string, unknown>).__MOCK_SEED_STUDY__ = {
        id: 'study-e2e-1',
        categoryId: 'cat-e2e-1',
        name: 'Spanish A2',
        method: 'anki',
      }
    })
    await page.goto('/')
    await page.waitForSelector('[data-testid="categories-view"]')
  })

  // ── E2E-1: Open with Ctrl+K, close with Escape ────────────────────────────

  test('E2E-1: Ctrl+K opens palette, Escape closes it', async ({ page }) => {
    // Palette must not be visible initially
    await expect(page.getByTestId('command-palette')).not.toBeVisible()

    // Open with Ctrl+K
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).not.toBeVisible()
  })

  // ── E2E-2: Filtering shows empty state on no match ────────────────────────

  test('E2E-2: typing with no matches shows empty state', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.waitForSelector('[data-testid="command-palette"]')

    await page.getByTestId('command-palette-input').fill('zzzzz')

    await expect(page.getByTestId('palette-item')).toHaveCount(0)
    await expect(page.getByTestId('palette-empty')).toBeVisible()
  })

  // ── E2E-3: Click item navigates to study-detail and closes palette ─────────

  test('E2E-3: clicking a study item navigates to study-detail and closes palette', async ({
    page,
  }) => {
    await page.keyboard.press('Control+k')
    await page.waitForSelector('[data-testid="command-palette"]')

    // The seeded study "Spanish A2" should appear
    const item = page.getByTestId('palette-item').filter({ hasText: 'Spanish A2' })
    await expect(item).toBeVisible({ timeout: 3000 })
    await item.click()

    // Palette must close
    await expect(page.getByTestId('command-palette')).not.toBeVisible()

    // App must have navigated to study-detail
    await expect(page.getByTestId('study-detail')).toBeVisible({ timeout: 3000 })
  })

  // ── E2E-4: Click on backdrop overlay closes palette without navigating ────

  test('E2E-4: clicking outside the panel closes palette without navigation', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.waitForSelector('[data-testid="command-palette"]')

    // Click at top-left corner — outside any panel
    await page.mouse.click(10, 10)

    await expect(page.getByTestId('command-palette')).not.toBeVisible()
    // Should still be on categories view
    await expect(page.getByTestId('categories-view')).toBeVisible()
  })
})
