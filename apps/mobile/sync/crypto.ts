import { base64ToBytes, bytesToBase64, passphraseBytes, utf8Decode, utf8Encode } from './bytes';
import {
  DATA_KEY_BYTES,
  DEFAULT_KDF_PARAMS,
  NONCE_BYTES,
  RECORD_AAD_PREFIX,
  WRAP_AAD_STRING,
} from './format';
import type { CryptoAdapter, KdfParams, PlainRecord } from './types';
import { SyncError } from './types';
import { canonicalJson, parsePlainRecord } from './payload';

export function recordAad(recordId: string): Uint8Array {
  return utf8Encode(`${RECORD_AAD_PREFIX}${recordId}`);
}

export function wrapAad(): Uint8Array {
  return utf8Encode(WRAP_AAD_STRING);
}

export async function deriveKek(
  crypto: CryptoAdapter,
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams
): Promise<Uint8Array> {
  const dkLen = params.keyLen ?? DEFAULT_KDF_PARAMS.keyLen;
  if (dkLen !== 32) throw new SyncError('crypto', 'scrypt keyLen must be 32');
  return crypto.scrypt(passphraseBytes(passphrase), salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen,
  });
}

export async function wrapDataKey(
  crypto: CryptoAdapter,
  kek: Uint8Array,
  dataKey: Uint8Array,
  nonce: Uint8Array
): Promise<string> {
  if (dataKey.length !== DATA_KEY_BYTES) throw new SyncError('crypto', 'data key must be 32 bytes');
  if (nonce.length !== NONCE_BYTES) throw new SyncError('crypto', 'nonce must be 12 bytes');
  const wrapped = await crypto.aesGcmEncrypt(kek, nonce, dataKey, wrapAad());
  return bytesToBase64(wrapped);
}

export async function unwrapDataKey(
  crypto: CryptoAdapter,
  kek: Uint8Array,
  wrappedKey: string,
  nonce: string
): Promise<Uint8Array> {
  try {
    const dataKey = await crypto.aesGcmDecrypt(
      kek,
      base64ToBytes(nonce),
      base64ToBytes(wrappedKey),
      wrapAad()
    );
    if (dataKey.length !== DATA_KEY_BYTES) throw new Error('bad key length');
    return dataKey;
  } catch {
    throw new SyncError('wrong_passphrase', 'Wrong passphrase or damaged wrapped key');
  }
}

export async function encryptPlainRecord(
  crypto: CryptoAdapter,
  dataKey: Uint8Array,
  record: PlainRecord,
  nonce: Uint8Array
): Promise<string> {
  if (nonce.length !== NONCE_BYTES) throw new SyncError('crypto', 'nonce must be 12 bytes');
  const plaintext = utf8Encode(canonicalJson(record));
  const ciphertext = await crypto.aesGcmEncrypt(
    dataKey,
    nonce,
    plaintext,
    recordAad(record.recordId)
  );
  return bytesToBase64(ciphertext);
}

export async function decryptPlainRecord(
  crypto: CryptoAdapter,
  dataKey: Uint8Array,
  recordId: string,
  nonce: string,
  ciphertext: string
): Promise<PlainRecord> {
  let bytes: Uint8Array;
  try {
    bytes = await crypto.aesGcmDecrypt(
      dataKey,
      base64ToBytes(nonce),
      base64ToBytes(ciphertext),
      recordAad(recordId)
    );
  } catch {
    throw new SyncError('decrypt_failed', 'Ciphertext failed authentication');
  }
  const record = parsePlainRecord(utf8Decode(bytes));
  if (record.recordId !== recordId.toLowerCase()) {
    throw new SyncError('decrypt_failed', 'Plaintext recordId does not match the op');
  }
  return record;
}
