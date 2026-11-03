import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  type ScryptOptions
} from 'node:crypto'

import { CryptoAuthError } from './errors'
import {
  DATA_KEY_BYTES,
  DEFAULT_KDF_PARAMS,
  GCM_TAG_BYTES,
  NONCE_BYTES,
  SALT_BYTES,
  WRAP_AAD,
  type KdfParams,
  recordAad,
  resolveKeyLen
} from './protocol'

export { recordAad }

/** NFKC, then UTF-8. No trimming and no trailing NUL. */
export function passphraseBytes(passphrase: string): Buffer {
  return Buffer.from(passphrase.normalize('NFKC'), 'utf8')
}

export function toBase64(bytes: Buffer): string {
  return bytes.toString('base64')
}

export function fromBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

/**
 * RFC 7914 scrypt via OpenSSL (Node `crypto.scrypt`).
 * `salt` is the raw salt bytes, not the base64 text.
 * The output is the AES-256 wrapping key.
 */
export function deriveWrappingKey(passphrase: string, salt: Buffer, params: KdfParams): Buffer {
  const keyLen = resolveKeyLen(params)
  if (keyLen !== DATA_KEY_BYTES) {
    throw new Error(`unsupported scrypt keyLen ${keyLen}; techoo sync v1 uses 32`)
  }
  if (!Number.isInteger(params.N) || params.N < 2 || (params.N & (params.N - 1)) !== 0) {
    throw new Error('scrypt N must be a power of two')
  }
  if (!Number.isInteger(params.r) || params.r < 1 || !Number.isInteger(params.p) || params.p < 1) {
    throw new Error('scrypt r and p must be positive integers')
  }
  // OpenSSL rejects the call when 128 * N * r * p exceeds maxmem. Leave headroom.
  const maxmem = Math.max(64 * 1024 * 1024, 128 * params.N * params.r * params.p * 2)
  const options: ScryptOptions = { N: params.N, r: params.r, p: params.p, maxmem }
  return scryptSync(passphraseBytes(passphrase), salt, keyLen, options)
}

function assertAesKey(key: Buffer): void {
  if (key.length !== DATA_KEY_BYTES) {
    throw new Error(`AES-256-GCM key must be ${DATA_KEY_BYTES} bytes`)
  }
}

function assertNonce(nonce: Buffer): void {
  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`AES-GCM nonce must be ${NONCE_BYTES} bytes`)
  }
}

/**
 * AES-256-GCM. The returned buffer is ciphertext || 16-byte tag, matching WebCrypto `encrypt`.
 * `aad` is raw associated data (already UTF-8 bytes).
 */
export function encryptAesGcm(key: Buffer, nonce: Buffer, plaintext: Buffer, aad: Buffer): Buffer {
  assertAesKey(key)
  assertNonce(nonce)
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_BYTES })
  cipher.setAAD(aad)
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([body, cipher.getAuthTag()])
}

export function decryptAesGcm(key: Buffer, nonce: Buffer, sealed: Buffer, aad: Buffer): Buffer {
  assertAesKey(key)
  assertNonce(nonce)
  if (sealed.length < GCM_TAG_BYTES) {
    throw new CryptoAuthError('ciphertext is shorter than the auth tag')
  }
  const body = sealed.subarray(0, sealed.length - GCM_TAG_BYTES)
  const tag = sealed.subarray(sealed.length - GCM_TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: GCM_TAG_BYTES })
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(body), decipher.final()])
  } catch {
    throw new CryptoAuthError()
  }
}

export function wrapDataKey(wrappingKey: Buffer, dataKey: Buffer, nonce: Buffer): Buffer {
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new Error(`data key must be ${DATA_KEY_BYTES} bytes`)
  }
  return encryptAesGcm(wrappingKey, nonce, dataKey, Buffer.from(WRAP_AAD, 'utf8'))
}

export function unwrapDataKey(wrappingKey: Buffer, wrappedKey: Buffer, nonce: Buffer): Buffer {
  const dataKey = decryptAesGcm(wrappingKey, nonce, wrappedKey, Buffer.from(WRAP_AAD, 'utf8'))
  if (dataKey.length !== DATA_KEY_BYTES) {
    throw new CryptoAuthError('unwrapped data key has the wrong length')
  }
  return dataKey
}

/** Encrypt a canonical plaintext record. AAD is `techoo.sync.v1|<recordId>`. */
export function sealRecord(
  dataKey: Buffer,
  recordId: string,
  plaintext: string,
  nonce: Buffer
): Buffer {
  return encryptAesGcm(
    dataKey,
    nonce,
    Buffer.from(plaintext, 'utf8'),
    Buffer.from(recordAad(recordId), 'utf8')
  )
}

export function openRecord(
  dataKey: Buffer,
  recordId: string,
  sealed: Buffer,
  nonce: Buffer
): string {
  const plaintext = decryptAesGcm(dataKey, nonce, sealed, Buffer.from(recordAad(recordId), 'utf8'))
  return plaintext.toString('utf8')
}

export function chainPreimage(
  prevHash: string,
  seq: number,
  recordId: string,
  ciphertext: string
): string {
  return `${prevHash}|${seq}|${recordId}|${ciphertext}`
}

/** Lowercase hex SHA-256 of the UTF-8 preimage. Matches the server's `chainHash`. */
export function chainHash(
  prevHash: string,
  seq: number,
  recordId: string,
  ciphertext: string
): string {
  return createHash('sha256')
    .update(chainPreimage(prevHash, seq, recordId, ciphertext), 'utf8')
    .digest('hex')
}

export interface MintedVault {
  salt: Buffer
  dataKey: Buffer
  wrapNonce: Buffer
  wrappingKey: Buffer
  wrappedKey: Buffer
  kdfParams: KdfParams
}

export function mintVault(passphrase: string, params: KdfParams = DEFAULT_KDF_PARAMS): MintedVault {
  const salt = randomBytes(SALT_BYTES)
  const dataKey = randomBytes(DATA_KEY_BYTES)
  const wrapNonce = randomBytes(NONCE_BYTES)
  const wrappingKey = deriveWrappingKey(passphrase, salt, params)
  const wrappedKey = wrapDataKey(wrappingKey, dataKey, wrapNonce)
  return {
    salt,
    dataKey,
    wrapNonce,
    wrappingKey,
    wrappedKey,
    kdfParams: { ...params, keyLen: resolveKeyLen(params) }
  }
}
