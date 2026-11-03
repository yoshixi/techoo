import { scryptSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  CryptoAuthError,
  WRAP_AAD,
  decodePayload,
  deriveWrappingKey,
  encodePayload,
  fromBase64,
  openRecord,
  passphraseBytes,
  recordAad,
  sealRecord,
  toBase64,
  unwrapDataKey,
  wrapDataKey
} from './index'
import { loadTestVectors } from './vectors'

const vectors = loadTestVectors()

describe('golden KDF and key wrap', () => {
  it('matches the RFC 7914 scrypt vector', () => {
    const derived = scryptSync('password', 'NaCl', 64, {
      N: 1024,
      r: 8,
      p: 16,
      maxmem: 64 * 1024 * 1024
    })
    expect(derived.toString('hex')).toBe(
      'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'
    )
  })

  it('derives the golden wrapping key and wraps the golden data key', () => {
    const salt = fromBase64(vectors.saltBase64)
    const wrappingKey = deriveWrappingKey(vectors.passphrase, salt, vectors.kdf)
    expect(toBase64(wrappingKey)).toBe(vectors.wrappingKeyBase64)

    const wrong = deriveWrappingKey(vectors.wrongPassphrase, salt, vectors.kdf)
    expect(toBase64(wrong)).toBe(vectors.wrongPassphraseWrappingKeyBase64)
    expect(toBase64(wrong)).not.toBe(vectors.wrappingKeyBase64)

    const dataKey = fromBase64(vectors.dataKeyBase64)
    const nonce = fromBase64(vectors.wrap.nonceBase64)
    expect(vectors.wrap.aad).toBe(WRAP_AAD)
    expect(toBase64(wrapDataKey(wrappingKey, dataKey, nonce))).toBe(vectors.wrap.wrappedKeyBase64)
    expect(
      toBase64(unwrapDataKey(wrappingKey, fromBase64(vectors.wrap.wrappedKeyBase64), nonce))
    ).toBe(vectors.dataKeyBase64)
  })

  it('rejects a wrong passphrase and a tampered wrapped key', () => {
    const salt = fromBase64(vectors.saltBase64)
    const wrong = deriveWrappingKey(vectors.wrongPassphrase, salt, vectors.kdf)
    const nonce = fromBase64(vectors.wrap.nonceBase64)
    expect(() => unwrapDataKey(wrong, fromBase64(vectors.wrap.wrappedKeyBase64), nonce)).toThrow(
      CryptoAuthError
    )

    const tampered = fromBase64(vectors.wrap.wrappedKeyBase64)
    tampered[0] = tampered[0] ^ 0x01
    const wrappingKey = fromBase64(vectors.wrappingKeyBase64)
    expect(() => unwrapDataKey(wrappingKey, tampered, nonce)).toThrow(CryptoAuthError)
  })

  it('treats NFKC-equivalent passphrases as the same password', () => {
    const salt = fromBase64(vectors.saltBase64)
    const decomposed = String.fromCodePoint(...vectors.normalization.decomposedCodePoints)
    expect(
      passphraseBytes(decomposed).equals(passphraseBytes(vectors.normalization.composed))
    ).toBe(true)
    expect(toBase64(deriveWrappingKey(decomposed, salt, vectors.kdf))).toBe(
      vectors.normalization.wrappingKeyBase64
    )
    expect(toBase64(deriveWrappingKey(vectors.normalization.composed, salt, vectors.kdf))).toBe(
      vectors.normalization.wrappingKeyBase64
    )
  })
})

describe('golden AES-GCM records', () => {
  const dataKey = fromBase64(vectors.dataKeyBase64)

  it('seals each sample to the golden ciphertext and opens it', () => {
    for (const sample of vectors.records) {
      expect(
        encodePayload({
          v: 1,
          kind: sample.kind,
          recordId: sample.recordId,
          deleted: sample.deleted,
          updatedAt: sample.updatedAt,
          fields: sample.fields
        })
      ).toBe(sample.plaintext)
      expect(recordAad(sample.recordId)).toBe(sample.aad)
      const sealed = sealRecord(
        dataKey,
        sample.recordId,
        sample.plaintext,
        fromBase64(sample.nonceBase64)
      )
      expect(toBase64(sealed)).toBe(sample.ciphertextBase64)
      expect(openRecord(dataKey, sample.recordId, sealed, fromBase64(sample.nonceBase64))).toBe(
        sample.plaintext
      )
      const payload = decodePayload(sample.plaintext, sample.recordId)
      expect(payload.kind).toBe(sample.kind)
      expect(payload.deleted).toBe(sample.deleted)
      expect(payload.fields).toEqual(sample.fields)
    }
  })

  it('rejects tampered ciphertext and a different record id as AAD', () => {
    const note = vectors.records[0]
    expect(note).toBeDefined()
    if (!note) return
    expect(() =>
      openRecord(
        dataKey,
        vectors.tampered.recordId,
        fromBase64(vectors.tampered.ciphertextBase64),
        fromBase64(vectors.tampered.nonceBase64)
      )
    ).toThrow(CryptoAuthError)
    expect(() =>
      openRecord(
        dataKey,
        vectors.wrongAad.recordId,
        fromBase64(note.ciphertextBase64),
        fromBase64(note.nonceBase64)
      )
    ).toThrow(CryptoAuthError)
  })
})
