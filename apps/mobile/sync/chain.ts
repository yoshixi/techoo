import { bytesToHex, utf8Encode } from './bytes';
import { GENESIS_HASH } from './format';
import type { CryptoAdapter, SyncOpWire } from './types';

export async function chainHash(
  crypto: CryptoAdapter,
  prevHash: string,
  seq: number,
  recordId: string,
  ciphertext: string
): Promise<string> {
  const digest = await crypto.sha256(utf8Encode(`${prevHash}|${seq}|${recordId}|${ciphertext}`));
  return bytesToHex(digest);
}

export type ChainStart = { seq: number; hash: string };

export type ChainCheck =
  | { ok: true; endSeq: number; endHash: string }
  | { ok: false; seq: number; reason: string };

/**
 * Ops must already be in ascending seq order. The first op's prevHash is the
 * cursor hash (genesis when the cursor is 0) and each seq is exactly one more
 * than the previous.
 */
export async function verifyChain(
  crypto: CryptoAdapter,
  start: ChainStart,
  ops: SyncOpWire[]
): Promise<ChainCheck> {
  let prevHash = start.hash;
  let prevSeq = start.seq;
  for (const op of ops) {
    if (op.seq !== prevSeq + 1) {
      return { ok: false, seq: op.seq, reason: `expected seq ${prevSeq + 1}, got ${op.seq}` };
    }
    if (op.prevHash !== prevHash) {
      return { ok: false, seq: op.seq, reason: 'prevHash does not match the previous link' };
    }
    prevHash = await chainHash(crypto, op.prevHash, op.seq, op.recordId, op.ciphertext);
    prevSeq = op.seq;
  }
  return { ok: true, endSeq: prevSeq, endHash: prevHash };
}

export function genesisStart(): ChainStart {
  return { seq: 0, hash: GENESIS_HASH };
}
