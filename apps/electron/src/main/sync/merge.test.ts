import { describe, expect, it } from 'vitest'

import { foldRecords } from './index'
import type { MergeRecord } from './merge'
import { loadTestVectors } from './vectors'

const vectors = loadTestVectors()

function titleOf(record: MergeRecord | null): string | null {
  if (!record || record.deleted) return null
  const title = record.fields.title
  return typeof title === 'string' ? title : null
}

describe('merge rules', () => {
  it('follows every golden merge case', () => {
    expect(vectors.mergeCases.length).toBeGreaterThanOrEqual(8)
    for (const sample of vectors.mergeCases) {
      const merged = foldRecords(sample.incoming, sample.localDeviceId, sample.start)
      expect(merged, sample.name).not.toBeNull()
      if (!merged) continue
      expect(titleOf(merged), sample.name).toBe(sample.expect.title)
      expect(merged.deleted, sample.name).toBe(sample.expect.deleted)
      expect(merged.updatedAt, sample.name).toBe(sample.expect.updatedAt)
      expect(merged.originSeq, sample.name).toBe(sample.expect.originSeq)
      expect(merged.originDeviceId, sample.name).toBe(sample.expect.originDeviceId)
      expect(merged.dirty, sample.name).toBe(sample.expect.dirty)
      if (sample.orderIndependent) {
        const reversed = foldRecords(
          [...sample.incoming].reverse(),
          sample.localDeviceId,
          sample.start
        )
        expect(reversed, sample.name).toEqual(merged)
      }
    }
  })
})
