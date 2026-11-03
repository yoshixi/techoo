import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  canonicalJson,
  chainHash,
  createNobleCrypto,
  decryptPlainRecord,
  deriveKek,
  hexToBytes,
  unwrapDataKey,
  wrapDataKey,
} from '@/sync';
import { passphraseBytes, utf8Encode } from '@/sync/bytes';

const crypto = createNobleCrypto();
const vectors = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sync-vectors.json'), 'utf8')
) as {
  passphrase: string;
  wrongPassphrase: string;
  kdf: { N: number; r: number; p: number; keyLen: number };
  saltBase64: string;
  wrappingKeyBase64: string;
  wrongPassphraseWrappingKeyBase64: string;
  dataKeyHex: string;
  wrap: { aad: string; nonceBase64: string; wrappedKeyBase64: string };
  normalization: { composed: string; decomposedCodePoints: number[]; wrappingKeyBase64: string };
  records: Array<{
    recordId: string;
    plaintext: string;
    nonceBase64: string;
    ciphertextBase64: string;
    fields: { title?: string; body?: string };
    deleted: boolean;
  }>;
  chain: {
    ops: Array<{
      prevHash: string;
      seq: number;
      recordId: string;
      ciphertextBase64: string;
      hash: string;
      preimage: string;
    }>;
  };
  tampered: { recordId: string; nonceBase64: string; ciphertextBase64: string; hash: string };
  wrongAad: { recordId: string };
};

describe('desktop golden vectors', () => {
  it('matches the RFC 7914 scrypt vector', async () => {
    const out = await crypto.scrypt(utf8Encode('password'), utf8Encode('NaCl'), {
      N: 1024,
      r: 8,
      p: 16,
      dkLen: 64,
    });
    expect(bytesToHex(out)).toBe(
      'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'
    );
  });

  it('derives the wrapping key and the NFKC pair', async () => {
    const salt = base64ToBytes(vectors.saltBase64);
    const kek = await deriveKek(crypto, vectors.passphrase, salt, vectors.kdf);
    expect(bytesToBase64(kek)).toBe(vectors.wrappingKeyBase64);
    const wrong = await deriveKek(crypto, vectors.wrongPassphrase, salt, vectors.kdf);
    expect(bytesToBase64(wrong)).toBe(vectors.wrongPassphraseWrappingKeyBase64);
    const composed = await deriveKek(crypto, vectors.normalization.composed, salt, vectors.kdf);
    const decomposed = await deriveKek(
      crypto,
      String.fromCodePoint(...vectors.normalization.decomposedCodePoints),
      salt,
      vectors.kdf
    );
    expect(bytesToBase64(composed)).toBe(vectors.normalization.wrappingKeyBase64);
    expect(bytesToBase64(decomposed)).toBe(vectors.normalization.wrappingKeyBase64);
    expect(bytesToHex(passphraseBytes(vectors.normalization.composed))).toBe(
      bytesToHex(
        passphraseBytes(String.fromCodePoint(...vectors.normalization.decomposedCodePoints))
      )
    );
  });

  it('wraps and unwraps the data key', async () => {
    const kek = base64ToBytes(vectors.wrappingKeyBase64);
    const dataKey = hexToBytes(vectors.dataKeyHex);
    const wrapped = await wrapDataKey(
      crypto,
      kek,
      dataKey,
      base64ToBytes(vectors.wrap.nonceBase64)
    );
    expect(wrapped).toBe(vectors.wrap.wrappedKeyBase64);
    expect(bytesToHex(await unwrapDataKey(crypto, kek, wrapped, vectors.wrap.nonceBase64))).toBe(
      vectors.dataKeyHex
    );
  });

  it('rejects the wrong passphrase and a tampered wrap', async () => {
    const salt = base64ToBytes(vectors.saltBase64);
    const wrong = await deriveKek(crypto, vectors.wrongPassphrase, salt, vectors.kdf);
    await expect(
      unwrapDataKey(crypto, wrong, vectors.wrap.wrappedKeyBase64, vectors.wrap.nonceBase64)
    ).rejects.toThrow(/passphrase/i);
    const bytes = base64ToBytes(vectors.wrap.wrappedKeyBase64);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const kek = base64ToBytes(vectors.wrappingKeyBase64);
    await expect(
      unwrapDataKey(crypto, kek, Buffer.from(bytes).toString('base64'), vectors.wrap.nonceBase64)
    ).rejects.toThrow(/passphrase|damaged/i);
  });

  it('reproduces each record plaintext and decrypts the desktop ciphertext', async () => {
    const dataKey = hexToBytes(vectors.dataKeyHex);
    for (const record of vectors.records) {
      const parsed = JSON.parse(record.plaintext) as unknown;
      expect(canonicalJson(parsed)).toBe(record.plaintext);
      const plain = await decryptPlainRecord(
        crypto,
        dataKey,
        record.recordId,
        record.nonceBase64,
        record.ciphertextBase64
      );
      expect(canonicalJson(plain)).toBe(record.plaintext);
      expect(plain.deleted).toBe(record.deleted);
    }
  });

  it('rejects tampered ciphertext and a different AAD', async () => {
    const dataKey = hexToBytes(vectors.dataKeyHex);
    const note = vectors.records[0]!;
    await expect(
      decryptPlainRecord(
        crypto,
        dataKey,
        vectors.tampered.recordId,
        vectors.tampered.nonceBase64,
        vectors.tampered.ciphertextBase64
      )
    ).rejects.toThrow(/authentication/i);
    await expect(
      decryptPlainRecord(
        crypto,
        dataKey,
        vectors.wrongAad.recordId,
        note.nonceBase64,
        note.ciphertextBase64
      )
    ).rejects.toThrow(/authentication/i);
  });

  it('recomputes the hash chain, including the tampered break', async () => {
    for (const op of vectors.chain.ops) {
      const hash = await chainHash(crypto, op.prevHash, op.seq, op.recordId, op.ciphertextBase64);
      expect(hash).toBe(op.hash);
      expect(createHash('sha256').update(op.preimage, 'utf8').digest('hex')).toBe(op.hash);
    }
    const tampered = await chainHash(
      crypto,
      vectors.chain.ops[0]!.prevHash,
      1,
      vectors.tampered.recordId,
      vectors.tampered.ciphertextBase64
    );
    expect(tampered).toBe(vectors.tampered.hash);
    expect(tampered).not.toBe(vectors.chain.ops[1]!.prevHash);
  });
});
