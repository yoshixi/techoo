import { chainHash, createNobleCrypto, GENESIS_HASH, verifyChain, type SyncOpWire } from '@/sync';

const crypto = createNobleCrypto();
const recordId = '11111111-1111-4111-8111-111111111111';

describe('hash chain', () => {
  it('accepts a contiguous chain and rejects a broken link or a gap', async () => {
    const first = await chainHash(crypto, GENESIS_HASH, 1, recordId, 'note-v1');
    const second = await chainHash(crypto, first, 2, recordId, 'note-v2');
    const ops: SyncOpWire[] = [
      {
        seq: 1,
        prevHash: GENESIS_HASH,
        clientOpId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        recordId,
        deviceId: '22222222-2222-4222-8222-222222222222',
        nonce: 'AAAA',
        ciphertext: 'note-v1',
      },
      {
        seq: 2,
        prevHash: first,
        clientOpId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        recordId,
        deviceId: '22222222-2222-4222-8222-222222222222',
        nonce: 'AAAA',
        ciphertext: 'note-v2',
      },
    ];
    const ok = await verifyChain(crypto, { seq: 0, hash: GENESIS_HASH }, ops);
    expect(ok).toEqual({ ok: true, endSeq: 2, endHash: second });

    const broken = await verifyChain(crypto, { seq: 0, hash: GENESIS_HASH }, [
      { ...ops[0]!, prevHash: 'f'.repeat(64) },
    ]);
    expect(broken.ok).toBe(false);

    const tampered = await verifyChain(crypto, { seq: 0, hash: GENESIS_HASH }, [
      { ...ops[0]!, ciphertext: 'note-v1-tampered' },
    ]);
    expect(tampered.ok).toBe(true);
    if (tampered.ok) expect(tampered.endHash).not.toBe(first);

    const gap = await verifyChain(crypto, { seq: 0, hash: GENESIS_HASH }, [ops[1]!]);
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.reason).toMatch(/seq/);
  });
});
