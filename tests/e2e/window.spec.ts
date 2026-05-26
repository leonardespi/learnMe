import { test, expect } from '@playwright/test'

test('app window shows learnMe', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText('learnMe')
})
