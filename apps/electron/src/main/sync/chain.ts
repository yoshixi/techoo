import { chainHash } from './crypto'
import { GENESIS_HASH } from './protocol'

export interface ChainLink {
  seq: number
  recordId: string
  ciphertext: string
  prevHash: string
}

export type ChainVerification =
  | { ok: true; headHash: string }
  | { ok: false; seq: number; reason: string }

/**
 * Recompute the hash chain.
 * `startPrevHash` is the hash of the op at `startSeq` (genesis when startSeq is 0).
 * `ops` must be the contiguous suffix starting at startSeq + 1.
 * `expectedHeadHash` is the server's head hash after the last op (or startPrevHash when ops is empty).
 */
export function verifyChain(
  startPrevHash: string,
  startSeq: number,
  ops: readonly ChainLink[],
  expectedHeadHash: string
): ChainVerification {
  if (!/^[0-9a-f]{64}$/.test(startPrevHash)) {
    return { ok: false, seq: startSeq, reason: 'start hash is not 64 lowercase hex characters' }
  }
  if (!/^[0-9a-f]{64}$/.test(expectedHeadHash)) {
    return { ok: false, seq: startSeq, reason: 'head hash is not 64 lowercase hex characters' }
  }
  let prevHash = startPrevHash
  let seq = startSeq
  for (const op of ops) {
    const expectedSeq = seq + 1
    if (op.seq !== expectedSeq) {
      return {
        ok: false,
        seq: op.seq,
        reason: `expected seq ${expectedSeq} and received ${op.seq}`
      }
    }
    if (op.prevHash !== prevHash) {
      return {
        ok: false,
        seq: op.seq,
        reason: `prevHash does not extend ${prevHash}`
      }
    }
    prevHash = chainHash(prevHash, op.seq, op.recordId, op.ciphertext)
    seq = op.seq
  }
  if (prevHash !== expectedHeadHash) {
    return {
      ok: false,
      seq,
      reason: `chain ended at ${prevHash} but the server head is ${expectedHeadHash}`
    }
  }
  return { ok: true, headHash: prevHash }
}

export function assertGenesis(hash: string): boolean {
  return hash === GENESIS_HASH
}
