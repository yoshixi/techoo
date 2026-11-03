/** Canonical constants for techoo encrypted sync v1. See ./spec.md. */

export const PROTOCOL_ID = 'techoo-e2ee-sync-v1'

/** SHA-256 hex of an empty chain. The first op's prevHash is this value. The server uses the same constant. */
export const GENESIS_HASH = '0'.repeat(64)

/** UTF-8 associated data for wrapping the data key. */
export const WRAP_AAD = 'techoo.vault.wrap.v1'

/** Record AAD is `${RECORD_AAD_PREFIX}${recordId}` in UTF-8. recordId is lowercase. */
export const RECORD_AAD_PREFIX = 'techoo.sync.v1|'

export const DATA_KEY_BYTES = 32
export const SALT_BYTES = 16
export const NONCE_BYTES = 12
export const GCM_TAG_BYTES = 16

/** Default scrypt parameters this client writes. N is 2^14. keyLen is always sent. */
export const DEFAULT_KDF_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32
} as const

export const PUSH_BATCH_LIMIT = 50
export const PULL_PAGE_LIMIT = 100
export const CIPHERTEXT_MAX_CHARS = 1_000_000

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export type RecordKind = 'todo' | 'post' | 'note'

export const RECORD_KINDS: readonly RecordKind[] = ['todo', 'post', 'note']

export interface KdfParams {
  N: number
  r: number
  p: number
  /** Omitted by a peer means 32. This client always writes 32 and only accepts 32. */
  keyLen?: number
}

export function recordAad(recordId: string): string {
  return `${RECORD_AAD_PREFIX}${recordId}`
}

export function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase UUID`)
  }
}

export function assertTimestamp(value: string, label: string): void {
  if (!ISO_TIMESTAMP.test(value) || new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be an ISO-8601 UTC timestamp with milliseconds`)
  }
}

export function resolveKeyLen(params: KdfParams): number {
  return params.keyLen ?? 32
}
