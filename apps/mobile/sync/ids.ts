import { sha1 } from '@noble/hashes/legacy.js';
import { RECORD_ID_NAMESPACE } from './format';
import { concatBytes, utf8Encode } from './bytes';

export function formatUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error('UUID is 16 bytes');
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error('invalid UUID');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** RFC 4122 UUID version 4. The result is lowercase. */
export function uuidV4(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/** RFC 4122 UUID version 5 (SHA-1). The result is lowercase. */
export function uuidV5(name: string, namespace: string): string {
  const hash = sha1(concatBytes([uuidToBytes(namespace), utf8Encode(name)]));
  const bytes = hash.slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

export function favoriteRecordId(postRecordId: string): string {
  return uuidV5(`techoo-sync-v1/post_favorite/${postRecordId.toLowerCase()}`, RECORD_ID_NAMESPACE);
}

export function listItemRecordId(listRecordId: string, postRecordId: string): string {
  return uuidV5(
    `techoo-sync-v1/post_list_item/${listRecordId.toLowerCase()}/${postRecordId.toLowerCase()}`,
    RECORD_ID_NAMESPACE
  );
}
