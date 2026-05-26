import { describe, it, expect } from 'vitest'
import { app } from '@/app'

describe('app', () => {
  it('exports app object', () => {
    expect(app).toBeDefined()
  })
})
