// Phase 5 — E2E tests for review session UI (Playwright against Vite dev server + mock-ipc).
// MUST FAIL (red) until ReviewSession component and navigation to session are implemented.
import { test, expect } from '@playwright/test'

// Helper: seed a deck with N new cards via mock-ipc state
async function seedDeckAndNavigate(
  page: import('@playwright/test').Page,
  deckName: string,
  cardCount: 5 | 10,
) {
  const fixturePath = `/fixtures/decks/review-session-${cardCount}.json`
  await page.goto('/')
  await page.waitForSelector('[data-testid="categories-view"]')

  // Create category
  await page.getByRole('button', { name: /nueva categoría|add category/i }).click()
  await page.getByRole('textbox').fill('Test Cat')
  await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
  await page.getByText('Test Cat').click()

  // Create study/deck
  await page.getByRole('button', { name: /nuevo estudio|add study/i }).click()
  await page.getByRole('textbox', { name: /nombre|name/i }).fill(deckName)
  await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
  await page.getByText(deckName).click()

  // Import fixture
  await page.getByRole('button', { name: /importar/i }).click()
  // The import dialog expects a file path; in mock-ipc context we supply fixture path via input or eval
  await page.evaluate((path) => {
    // Trigger mock import directly — E2E mock intercepts 'import_anki_deck'
    window.dispatchEvent(new CustomEvent('mock:import', { detail: { fixturePath: path } }))
  }, fixturePath)
  await page.waitForTimeout(300)
}

test.describe('Phase 5 — Review Session E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear mock state between tests
    await page.addInitScript(() => {
      localStorage.clear()
      // Reset in-memory mock state on next load
      window.__MOCK_RESET__ = true
    })
  })

  // E2E Test 1: Complete session of 10 cards using keyboard
  test('complete session of 10 cards with keyboard: Space+3 each card', async ({ page }) => {
    await seedDeckAndNavigate(page, 'E2E Deck 10', 10)

    await page.getByRole('button', { name: /iniciar repaso|start review|estudiar/i }).click()
    await expect(page.locator('[data-testid="review-session"]')).toBeVisible()

    for (let i = 0; i < 10; i++) {
      // Front phase: back should not be visible
      await expect(page.locator('[data-testid="card-back"]')).not.toBeVisible()
      // Reveal with Space
      await page.keyboard.press('Space')
      await expect(page.locator('[data-testid="card-back"]')).toBeVisible()
      // Grade Good with key 3
      await page.keyboard.press('3')
      await page.waitForTimeout(100)
    }

    await expect(page.locator('[data-testid="session-complete"]')).toBeVisible()

    // Verify DB: all cards are no longer 'new'
    const cards = await page.evaluate(() =>
      // any-justified: eval context for E2E test verification via mock state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__MOCK_STATE__?.cards ?? [],
    )
    const newCards = cards.filter((c: { state: string }) => c.state === 'new')
    expect(newCards).toHaveLength(0)
  })

  // E2E Test 2: Keyboard shortcuts (Space = reveal, 1-4 = grade)
  test('Space reveals card and digit keys grade it', async ({ page }) => {
    await seedDeckAndNavigate(page, 'E2E KB Deck', 5)
    await page.getByRole('button', { name: /iniciar repaso|start review|estudiar/i }).click()
    await expect(page.locator('[data-testid="review-session"]')).toBeVisible()

    // Verify front phase
    await expect(page.locator('[data-testid="card-back"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="grade-buttons"]')).not.toBeVisible()

    // Space reveals
    await page.keyboard.press('Space')
    await expect(page.locator('[data-testid="card-back"]')).toBeVisible()
    await expect(page.locator('[data-testid="grade-buttons"]')).toBeVisible()

    // '3' grades and advances to next card
    await page.keyboard.press('3')
    await page.waitForTimeout(100)
    // Back to front phase OR session complete
    const isComplete = await page.locator('[data-testid="session-complete"]').isVisible()
    if (!isComplete) {
      await expect(page.locator('[data-testid="card-back"]')).not.toBeVisible()
    }
  })

  // E2E Test 3: Exit mid-session and return — progress reflects DB state
  test('exit mid-session and return: remaining cards ≤ initial - graded', async ({ page }) => {
    await seedDeckAndNavigate(page, 'E2E Midterm Deck', 5)
    await page.getByRole('button', { name: /iniciar repaso|start review|estudiar/i }).click()
    await expect(page.locator('[data-testid="review-session"]')).toBeVisible()

    // Grade 2 cards
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(50)
      await page.keyboard.press('3')
      await page.waitForTimeout(100)
    }

    // Capture progress after 2 grades
    const progressText = await page.locator('[data-testid="progress-indicator"]').textContent()
    expect(progressText).toMatch(/2/)

    // Navigate away
    await page.getByRole('button', { name: /salir|exit|atrás|back/i }).click()
    await expect(page.locator('[data-testid="categories-view"]')).not.toBeVisible({ timeout: 500 }).catch(() => {})
    // Navigate back to the study
    await page.getByText('E2E Midterm Deck').click()
    await page.getByRole('button', { name: /iniciar repaso|start review|estudiar/i }).click()

    // New session starts: progress done=0, total ≤ 3
    await expect(page.locator('[data-testid="review-session"]')).toBeVisible()
    const newProgressText = await page.locator('[data-testid="progress-indicator"]').textContent()
    // Total remaining should be ≤ 3 (2 graded cards have future due date)
    const match = newProgressText?.match(/(\d+)/)
    expect(Number(match?.[1] ?? 99)).toBeLessThanOrEqual(3)
  })

  // E2E Test 4: Deck with no pending cards shows complete immediately
  test('deck with no pending cards shows session-complete immediately', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="categories-view"]')

    // Create empty deck (no import)
    await page.getByRole('button', { name: /nueva categoría|add category/i }).click()
    await page.getByRole('textbox').fill('Empty Cat')
    await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
    await page.getByText('Empty Cat').click()
    await page.getByRole('button', { name: /nuevo estudio|add study/i }).click()
    await page.getByRole('textbox', { name: /nombre|name/i }).fill('Empty Deck')
    await page.getByRole('button', { name: /guardar|save|crear|create/i }).click()
    await page.getByText('Empty Deck').click()

    await page.getByRole('button', { name: /iniciar repaso|start review|estudiar/i }).click()
    await expect(page.locator('[data-testid="session-complete"]')).toBeVisible()
  })
})
