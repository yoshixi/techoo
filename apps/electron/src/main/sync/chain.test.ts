import { describe, expect, it } from 'vitest'

import { chainHash, chainPreimage, verifyChain } from './index'
import { GENESIS_HASH } from './protocol'
import { loadTestVectors } from './vectors'

const vectors = loadTestVectors()

describe('hash chain', () => {
  it('recomputes the golden chain from genesis', () => {
    expect(vectors.chain.genesis).toBe(GENESIS_HASH)
    let prev = GENESIS_HASH
    for (const op of vectors.chain.ops) {
      expect(op.prevHash).toBe(prev)
      expect(chainPreimage(prev, op.seq, op.recordId, op.ciphertextBase64)).toBe(op.preimage)
      expect(chainHash(prev, op.seq, op.recordId, op.ciphertextBase64)).toBe(op.hash)
      prev = op.hash
    }
    const verified = verifyChain(
      GENESIS_HASH,
      0,
      vectors.chain.ops.map((op) => ({
        seq: op.seq,
        recordId: op.recordId,
        ciphertext: op.ciphertextBase64,
        prevHash: op.prevHash
      })),
      prev
    )
    expect(verified).toEqual({ ok: true, headHash: prev })
  })

  it('accepts an empty suffix when the head hash is unchanged', () => {
    expect(verifyChain(GENESIS_HASH, 0, [], GENESIS_HASH)).toEqual({
      ok: true,
      headHash: GENESIS_HASH
    })
  })

  it('detects a tampered ciphertext, a gap, and a broken prevHash', () => {
    const ops = vectors.chain.ops.map((op) => ({
      seq: op.seq,
      recordId: op.recordId,
      ciphertext: op.ciphertextBase64,
      prevHash: op.prevHash
    }))
    const head = vectors.chain.ops[vectors.chain.ops.length - 1]?.hash
    expect(head).toBeDefined()
    const tampered = ops.map((op, index) =>
      index === 0 ? { ...op, ciphertext: vectors.tampered.ciphertextBase64 } : op
    )
    expect(
      chainHash(GENESIS_HASH, 1, vectors.tampered.recordId, vectors.tampered.ciphertextBase64)
    ).toBe(vectors.tampered.hash)
    expect(vectors.tampered.hash).not.toBe(ops[1]?.prevHash)
    const broken = verifyChain(GENESIS_HASH, 0, tampered, head ?? '')
    expect(broken.ok).toBe(false)

    const gap = verifyChain(GENESIS_HASH, 0, ops.slice(1), head ?? '')
    expect(gap.ok).toBe(false)
    if (!gap.ok) expect(gap.reason).toContain('seq')

    const relinked = ops.map((op, index) => (index === 1 ? { ...op, prevHash: GENESIS_HASH } : op))
    const unlinked = verifyChain(GENESIS_HASH, 0, relinked, head ?? '')
    expect(unlinked.ok).toBe(false)
  })
})
