import { createHash, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CryptoAuthError,
  WRAP_AAD,
  chainHash as desktopChainHash,
  deriveWrappingKey,
  encodePayload,
  foldRecords,
  fromBase64,
  openRecord,
  passphraseBytes as desktopPassphraseBytes,
  sealRecord,
  toBase64,
  unwrapDataKey as desktopUnwrap,
  wrapDataKey as desktopWrap,
} from '../../../apps/electron/src/main/sync/index'
import { loadTestVectors, type VectorMergeCase } from '../../../apps/electron/src/main/sync/vectors'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  canonicalJson,
  chainHash as mobileChainHash,
  createNobleCrypto,
  decryptPlainRecord,
  deriveKek,
  encryptPlainRecord,
  mergeRecord,
  passphraseBytes as mobilePassphraseBytes,
  unwrapDataKey as mobileUnwrap,
  wrapDataKey as mobileWrap,
  type PlainRecord,
} from '../../../apps/mobile/sync/node'
import type { MergeVersion } from '../../../apps/mobile/sync/merge'

const vectors = loadTestVectors()
const desktopVectorPath = new URL(
  '../../../apps/electron/src/main/sync/vectors/test-vectors.json',
  import.meta.url,
)
const mobileVectorPath = new URL(
  '../../../apps/mobile/__tests__/fixtures/sync-vectors.json',
  import.meta.url,
)
const noble = createNobleCrypto()

const RFC_SCRYPT =
  'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'

function titleOf(fields: { [key: string]: unknown }, deleted: boolean): string | null {
  if (deleted) return null
  return typeof fields.title === 'string' ? fields.title : null
}

function applyMobile(sample: VectorMergeCase): { version: MergeVersion; dirty: boolean } {
  const toVersion = (row: NonNullable<VectorMergeCase['start']>): MergeVersion => ({
    recordId: row.recordId,
    kind: row.kind,
    deleted: row.deleted,
    updatedAt: row.updatedAt,
    deviceId: row.originDeviceId,
    seq: row.originSeq,
    fields: row.fields,
  })
  let current = sample.start ? toVersion(sample.start) : null
  let dirty = sample.start?.dirty ?? false
  for (const row of sample.incoming) {
    const outcome = mergeRecord(current, toVersion(row))
    current = outcome.record
    if (outcome.applied) dirty = false
  }
  if (!current) throw new Error(`mobile merge produced no row for ${sample.name}`)
  return { version: current, dirty }
}

describe('shared golden vectors', () => {
  it('uses one vector file for both clients', () => {
    expect(readFileSync(desktopVectorPath, 'utf8')).toBe(readFileSync(mobileVectorPath, 'utf8'))
    expect(vectors.protocol).toBe('techoo-e2ee-sync-v1')
  })

  it('reproduces the RFC 7914 scrypt vector on both cores', async () => {
    const desktop = scryptSync('password', 'NaCl', 64, { N: 1024, r: 8, p: 16, maxmem: 64 * 1024 * 1024 })
    expect(desktop.toString('hex')).toBe(RFC_SCRYPT)
    const mobile = await noble.scrypt(new TextEncoder().encode('password'), new TextEncoder().encode('NaCl'), {
      N: 1024,
      r: 8,
      p: 16,
      dkLen: 64,
    })
    expect(bytesToHex(mobile)).toBe(RFC_SCRYPT)
  })

  it('derives the wrapping key, NFKC pair, and wrapped data key on both cores', async () => {
    const salt = fromBase64(vectors.saltBase64)
    expect(toBase64(deriveWrappingKey(vectors.passphrase, salt, vectors.kdf))).toBe(vectors.wrappingKeyBase64)
    expect(toBase64(deriveWrappingKey(vectors.wrongPassphrase, salt, vectors.kdf))).toBe(
      vectors.wrongPassphraseWrappingKeyBase64,
    )
    const decomposed = String.fromCodePoint(...vectors.normalization.decomposedCodePoints)
    expect(desktopPassphraseBytes(decomposed).equals(desktopPassphraseBytes(vectors.normalization.composed))).toBe(
      true,
    )
    expect(toBase64(deriveWrappingKey(decomposed, salt, vectors.kdf))).toBe(
      vectors.normalization.wrappingKeyBase64,
    )
    expect(vectors.wrap.aad).toBe(WRAP_AAD)
    const dataKey = fromBase64(vectors.dataKeyBase64)
    const nonce = fromBase64(vectors.wrap.nonceBase64)
    expect(toBase64(desktopWrap(fromBase64(vectors.wrappingKeyBase64), dataKey, nonce))).toBe(
      vectors.wrap.wrappedKeyBase64,
    )
    expect(toBase64(desktopUnwrap(fromBase64(vectors.wrappingKeyBase64), fromBase64(vectors.wrap.wrappedKeyBase64), nonce))).toBe(
      vectors.dataKeyBase64,
    )

    const kek = await deriveKek(noble, vectors.passphrase, base64ToBytes(vectors.saltBase64), vectors.kdf)
    expect(bytesToBase64(kek)).toBe(vectors.wrappingKeyBase64)
    const wrong = await deriveKek(noble, vectors.wrongPassphrase, base64ToBytes(vectors.saltBase64), vectors.kdf)
    expect(bytesToBase64(wrong)).toBe(vectors.wrongPassphraseWrappingKeyBase64)
    const mobileDecomposed = await deriveKek(noble, decomposed, base64ToBytes(vectors.saltBase64), vectors.kdf)
    expect(bytesToBase64(mobileDecomposed)).toBe(vectors.normalization.wrappingKeyBase64)
    expect(bytesToHex(mobilePassphraseBytes(decomposed))).toBe(
      bytesToHex(mobilePassphraseBytes(vectors.normalization.composed)),
    )
    const mobileWrapped = await mobileWrap(
      noble,
      base64ToBytes(vectors.wrappingKeyBase64),
      base64ToBytes(vectors.dataKeyBase64),
      base64ToBytes(vectors.wrap.nonceBase64),
    )
    expect(mobileWrapped).toBe(vectors.wrap.wrappedKeyBase64)
    expect(
      bytesToHex(
        await mobileUnwrap(noble, base64ToBytes(vectors.wrappingKeyBase64), mobileWrapped, vectors.wrap.nonceBase64),
      ),
    ).toBe(bytesToHex(base64ToBytes(vectors.dataKeyBase64)))
  })

  it('seals and opens every sample record on both cores', async () => {
    const dataKey = fromBase64(vectors.dataKeyBase64)
    for (const sample of vectors.records) {
      expect(
        encodePayload({
          v: 1,
          kind: sample.kind,
          recordId: sample.recordId,
          deleted: sample.deleted,
          updatedAt: sample.updatedAt,
          fields: sample.fields,
        }),
      ).toBe(sample.plaintext)
      const sealed = sealRecord(dataKey, sample.recordId, sample.plaintext, fromBase64(sample.nonceBase64))
      expect(toBase64(sealed)).toBe(sample.ciphertextBase64)
      expect(openRecord(dataKey, sample.recordId, sealed, fromBase64(sample.nonceBase64))).toBe(sample.plaintext)

      const plain = JSON.parse(sample.plaintext) as PlainRecord
      expect(canonicalJson(plain)).toBe(sample.plaintext)
      const mobileSealed = await encryptPlainRecord(
        noble,
        base64ToBytes(vectors.dataKeyBase64),
        plain,
        base64ToBytes(sample.nonceBase64),
      )
      expect(mobileSealed).toBe(sample.ciphertextBase64)
      const opened = await decryptPlainRecord(
        noble,
        base64ToBytes(vectors.dataKeyBase64),
        sample.recordId,
        sample.nonceBase64,
        sample.ciphertextBase64,
      )
      expect(canonicalJson(opened)).toBe(sample.plaintext)
    }
  })

  it('rejects tampered ciphertext and the wrong record id on both cores', async () => {
    const note = vectors.records[0]
    expect(note).toBeDefined()
    if (!note) return
    const dataKey = fromBase64(vectors.dataKeyBase64)
    expect(() =>
      openRecord(
        dataKey,
        vectors.tampered.recordId,
        fromBase64(vectors.tampered.ciphertextBase64),
        fromBase64(vectors.tampered.nonceBase64),
      ),
    ).toThrow(CryptoAuthError)
    expect(() =>
      openRecord(dataKey, vectors.wrongAad.recordId, fromBase64(note.ciphertextBase64), fromBase64(note.nonceBase64)),
    ).toThrow(CryptoAuthError)

    await expect(
      decryptPlainRecord(
        noble,
        base64ToBytes(vectors.dataKeyBase64),
        vectors.tampered.recordId,
        vectors.tampered.nonceBase64,
        vectors.tampered.ciphertextBase64,
      ),
    ).rejects.toThrow(/authentication/i)
    await expect(
      decryptPlainRecord(
        noble,
        base64ToBytes(vectors.dataKeyBase64),
        vectors.wrongAad.recordId,
        note.nonceBase64,
        note.ciphertextBase64,
      ),
    ).rejects.toThrow(/authentication/i)
  })

  it('recomputes the hash chain on both cores', async () => {
    for (const op of vectors.chain.ops) {
      expect(desktopChainHash(op.prevHash, op.seq, op.recordId, op.ciphertextBase64)).toBe(op.hash)
      expect(await mobileChainHash(noble, op.prevHash, op.seq, op.recordId, op.ciphertextBase64)).toBe(op.hash)
      expect(createHash('sha256').update(op.preimage, 'utf8').digest('hex')).toBe(op.hash)
    }
    const first = vectors.chain.ops[0]
    const second = vectors.chain.ops[1]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) return
    const desktopTampered = desktopChainHash(
      first.prevHash,
      1,
      vectors.tampered.recordId,
      vectors.tampered.ciphertextBase64,
    )
    const mobileTampered = await mobileChainHash(
      noble,
      first.prevHash,
      1,
      vectors.tampered.recordId,
      vectors.tampered.ciphertextBase64,
    )
    expect(desktopTampered).toBe(vectors.tampered.hash)
    expect(mobileTampered).toBe(vectors.tampered.hash)
    expect(desktopTampered).not.toBe(second.prevHash)
  })

  it('follows every golden merge case on both cores', () => {
    expect(vectors.mergeCases.length).toBeGreaterThanOrEqual(8)
    for (const sample of vectors.mergeCases) {
      const merged = foldRecords(sample.incoming, sample.localDeviceId, sample.start)
      expect(merged, sample.name).not.toBeNull()
      if (!merged) continue
      expect(titleOf(merged.fields, merged.deleted), sample.name).toBe(sample.expect.title)
      expect(merged.deleted, sample.name).toBe(sample.expect.deleted)
      expect(merged.updatedAt, sample.name).toBe(sample.expect.updatedAt)
      expect(merged.originSeq, sample.name).toBe(sample.expect.originSeq)
      expect(merged.originDeviceId, sample.name).toBe(sample.expect.originDeviceId)
      expect(merged.dirty, sample.name).toBe(sample.expect.dirty)
      if (sample.orderIndependent) {
        const reversed = foldRecords([...sample.incoming].reverse(), sample.localDeviceId, sample.start)
        expect(reversed, sample.name).toEqual(merged)
      }

      const mobileMerged = applyMobile(sample)
      expect(titleOf(mobileMerged.version.fields, mobileMerged.version.deleted), sample.name).toBe(sample.expect.title)
      expect(mobileMerged.version.deleted, sample.name).toBe(sample.expect.deleted)
      expect(mobileMerged.version.updatedAt, sample.name).toBe(sample.expect.updatedAt)
      expect(mobileMerged.version.seq, sample.name).toBe(sample.expect.originSeq)
      expect(mobileMerged.version.deviceId, sample.name).toBe(sample.expect.originDeviceId)
      expect(mobileMerged.dirty, sample.name).toBe(sample.expect.dirty)
      if (sample.orderIndependent) {
        const reversed = applyMobile({ ...sample, incoming: [...sample.incoming].reverse() })
        expect(reversed.version, sample.name).toEqual(mobileMerged.version)
        expect(reversed.dirty, sample.name).toBe(mobileMerged.dirty)
      }
    }
  })
})
