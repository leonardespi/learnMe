import { describe, it, expect } from 'vitest'
import type { RecordReviewResult, Card, ReviewLog } from '@/types/domain'

describe('Phase 2 domain types', () => {
    it('RecordReviewResult is exported with card and reviewLog fields', async () => {
        const mod = await import('@/types/domain')
        expect(mod).toBeDefined()

        // Type-level check: TypeScript compilation fails if RecordReviewResult
        // doesn't exist or has wrong shape. Verified by `tsc --noEmit` in CI.
        // any-justified: fixture construction for type shape check in unit test
        const dummy: RecordReviewResult = {
            card: {} as Card,
            reviewLog: {} as ReviewLog,
        }
        expect(dummy).toBeDefined()
    })
})
