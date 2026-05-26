import { defineConfig } from '@playwright/test'

// Config for E2E tests against the real Tauri binary via tauri-driver (WebDriver).
// Prerequisites — run scripts/run-native-e2e.sh or manually:
//   1. cargo install tauri-driver
//   2. sudo apt install webkit2gtk-driver xvfb
//   3. npm run tauri:build
//   4. export DISPLAY=:99 && Xvfb :99 -screen 0 1280x800x24 &
//   5. tauri-driver -- ./src-tauri/target/release/learnme &
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/phase8b_native.spec.ts'],
  timeout: 60_000,
  retries: process.env['CI'] ? 2 : 1,
  // Tests use raw WebDriver HTTP (no Playwright browser) — no use.baseURL needed.
  use: {},
})
