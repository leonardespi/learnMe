/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'

const MIME: Record<string, string> = { '.json': 'application/json', '.txt': 'text/plain' }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Serves ./fixtures/** at /fixtures/** for Playwright E2E mock:import event
      name: 'serve-fixtures',
      configureServer(server) {
        server.middlewares.use('/fixtures', (req, res, next) => {
          const filepath = resolve(__dirname, 'fixtures', (req.url ?? '/').slice(1))
          if (!existsSync(filepath)) { next(); return }
          res.setHeader('Content-Type', MIME[extname(filepath)] ?? 'application/octet-stream')
          createReadStream(filepath).pipe(res)
        })
      },
    },
  ],
  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Only measure files that are expected to have unit test coverage.
      // Layout, view-layer, store, entry-point, and mock files are E2E-tested only.
      include: [
        'src/features/categories/CategoryList.tsx',
        'src/features/studies/StudyDetail.tsx',
        'src/features/methods/anki/**',
        'src/features/stats/StatsView.tsx',
        'src/features/settings/SettingsView.tsx',
        'src/features/command-palette/CommandPalette.tsx',
        'src/shared/theme/**',
        'src/schemas/**',
        'src/types/**',
        'src/store/appStore.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
      },
    },
  },
})
