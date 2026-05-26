// Phase 7 unit tests — Zod schema for LearnmeFile and SettingsView render.
// These tests import from @/schemas/learnme and @/features/settings/SettingsView
// which do not exist yet. They MUST fail (red) until production code is written.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { LearnmeFileSchema } from '@/schemas/learnme'

const FIXTURE_PATH = resolve(__dirname, '../../fixtures/session/valid-session.learnme')

function loadValidFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'))
}

describe('LearnmeFileSchema — Zod validation', () => {
  it('T22: accepts valid-session.learnme fixture', () => {
    const data = loadValidFixture()
    const result = LearnmeFileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('T23: rejects object missing checksum field', () => {
    const data = loadValidFixture()
    delete data.checksum
    const result = LearnmeFileSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('checksum')
    }
  })

  it('T24: rejects version as string instead of number', () => {
    const data = loadValidFixture()
    data.version = '1'
    const result = LearnmeFileSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('T25: rejects card missing studyId field', () => {
    const data = loadValidFixture()
    delete data.data.cards[0].studyId
    const result = LearnmeFileSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('studyId'))).toBe(true)
    }
  })

  it('T26: rejects card with invalid state enum value', () => {
    const data = loadValidFixture()
    data.data.cards[0].state = 'archived'
    const result = LearnmeFileSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
