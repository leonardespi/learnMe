// Phase 6 — E2E tests for stats view (Playwright against Vite dev server + mock-ipc).
// MUST FAIL (red) until StatsView, get_stats mock handler, and btn-view-stats are implemented.
import { test, expect } from '@playwright/test'
import * as path from 'path'

async function seedDeckAndNavigateToStudy(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForSelector('[data-testid="categories-view"]')

  await page.getByRole('button', { name: /nueva categoría|add category/i }).click()
  await page.getByRole('textbox').fill('Stats Test Cat')
  await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
  await page.getByText('Stats Test Cat').click()

  await page.getByRole('button', { name: /nuevo estudio|add study/i }).click()
  await page.getByRole('textbox', { name: /nombre|name/i }).fill('Stats Deck')
  await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
  await page.getByText('Stats Deck').click()

  // Import deck via mock:import event (same pattern as phase 5)
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('mock:import', {
        detail: { fixturePath: '/fixtures/decks/spanish-a2-valid.json' },
      }),
    )
  })
  await page.waitForTimeout(300)
}

test.describe('Phase 6 — Stats View E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__MOCK_RESET__ = true
    })
  })

  test('navigates to stats view and recharts renders SVG', async ({ page }) => {
    await seedDeckAndNavigateToStudy(page)

    await page.click('[data-testid="btn-view-stats"]')
    await page.waitForSelector('[data-testid="stats-view"]')

    // Automated assertion: recharts must have rendered at least one SVG element
    const svgCount = await page.locator('svg').count()
    expect(svgCount).toBeGreaterThan(0)
  })

  test('stats view charts present in both light and dark themes', async ({ page }) => {
    await seedDeckAndNavigateToStudy(page)
    await page.click('[data-testid="btn-view-stats"]')
    await page.waitForSelector('[data-testid="stats-view"]')

    // Light theme: automated SVG assertion
    expect(await page.locator('svg').count()).toBeGreaterThan(0)

    // Save light theme snapshot for human review (exit gate §4.2 of test-plan)
    await page.screenshot({
      path: path.join('tests', 'e2e', 'snapshots', 'phase6-stats-light.png'),
    })

    // Toggle to dark theme
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForSelector('[data-theme="dark"]')

    // Dark theme: automated SVG assertion
    expect(await page.locator('svg').count()).toBeGreaterThan(0)

    // Save dark theme snapshot for human review
    await page.screenshot({
      path: path.join('tests', 'e2e', 'snapshots', 'phase6-stats-dark.png'),
    })
  })

  test('stats view is usable on mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await seedDeckAndNavigateToStudy(page)

    await page.click('[data-testid="btn-view-stats"]')
    await page.waitForSelector('[data-testid="stats-view"]')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
