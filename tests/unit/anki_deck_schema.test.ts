// Phase 3 unit tests — Zod schema for AnkiDeck
// These tests import from @/schemas/anki-deck which does not exist yet.
// They MUST fail (red) until production code is written in step 4.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AnkiDeckSchema } from '@/schemas/anki-deck'

const validDeck = {
  schemaVersion: '1.0.0',
  method: 'anki',
  name: 'Spanish A2 Vocabulary',
  tags: ['language', 'spanish'],
  cards: [
    { front: 'casa', back: 'house', tags: ['noun'] },
    { front: 'correr', back: 'to run', tags: ['verb'] },
  ],
}

describe('AnkiDeckSchema — Zod validation', () => {
  it('T24: accepts a valid deck object', () => {
    const result = AnkiDeckSchema.safeParse(validDeck)
    expect(result.success).toBe(true)
  })

  it('T25: rejects deck missing method field', () => {
    const { method: _method, ...withoutMethod } = validDeck
    const result = AnkiDeckSchema.safeParse(withoutMethod)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      expect(paths).toContainEqual(['method'])
    }
  })

  it('T26: rejects deck missing schemaVersion field', () => {
    const { schemaVersion: _sv, ...withoutVersion } = validDeck
    const result = AnkiDeckSchema.safeParse(withoutVersion)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      expect(paths).toContainEqual(['schemaVersion'])
    }
  })

  it('T27: rejects when cards is not an array', () => {
    const bad = { ...validDeck, cards: 'not an array' }
    const result = AnkiDeckSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path)
      expect(paths).toContainEqual(['cards'])
    }
  })

  it('T28: rejects card missing front field', () => {
    const bad = {
      ...validDeck,
      cards: [{ back: 'house', tags: [] }],
    }
    const result = AnkiDeckSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('front'))).toBe(true)
    }
  })

  it('T29: rejects card missing back field', () => {
    const bad = {
      ...validDeck,
      cards: [{ front: 'casa', tags: [] }],
    }
    const result = AnkiDeckSchema.safeParse(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('back'))).toBe(true)
    }
  })

  it('T30: tags field is optional and defaults to empty array', () => {
    const withoutTags = {
      ...validDeck,
      cards: [{ front: 'casa', back: 'house' }],
    }
    const result = AnkiDeckSchema.safeParse(withoutTags)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cards[0].tags).toEqual([])
    }
  })
})

describe('AnkiDeckSchema — JSON Schema generation and sync', () => {
  it('T31: zodToJsonSchema produces valid JSON Schema with required fields', () => {
    const jsonSchema = zodToJsonSchema(AnkiDeckSchema)
    expect(jsonSchema).toBeDefined()
    const schema = jsonSchema as Record<string, unknown>
    expect(schema).toHaveProperty('properties')
    const props = schema['properties'] as Record<string, unknown>
    expect(props).toHaveProperty('method')
    expect(props).toHaveProperty('cards')
    expect(props).toHaveProperty('schemaVersion')
  })

  it('T32: generated JSON Schema matches committed schemas/anki-deck.v1.json', () => {
    const schemaPath = resolve(__dirname, '../../schemas/anki-deck.v1.json')
    const committed = JSON.parse(readFileSync(schemaPath, 'utf-8'))
    const generated = zodToJsonSchema(AnkiDeckSchema)
    expect(generated).toEqual(committed)
  })
})
