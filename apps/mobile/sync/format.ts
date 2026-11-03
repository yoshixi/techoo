/**
 * Wire format for Techoo encrypted sync.
 *
 * The desktop client owns this format. Constants live here so a spec change
 * is a single edit. See WIRE_FORMAT.md for the byte layout.
 */

export const SYNC_FORMAT_VERSION = 1;

/** First prevHash. Matches the server genesis value. */
export const GENESIS_HASH = '0'.repeat(64);

export const KDF_NAME = 'scrypt' as const;

/** Default parameters written when this device creates or resets a vault. */
export const DEFAULT_KDF_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
} as const;

export const SALT_BYTES = 16;
export const DATA_KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const GCM_TAG_BYTES = 16;

/** ASCII AAD for wrapping the raw 32-byte data key. */
export const WRAP_AAD_STRING = 'techoo.vault.wrap.v1';

/**
 * Record AAD is the UTF-8 bytes of `${RECORD_AAD_PREFIX}${recordId}`.
 * recordId is lowercase. The vault id is not included.
 */
export const RECORD_AAD_PREFIX = 'techoo.sync.v1|';

/**
 * UUID v5 namespace for records whose id must be the same on every device.
 * Version nibble is 4 and the variant nibble is 8, so it is itself a valid UUID.
 */
export const RECORD_ID_NAMESPACE = '6f0e2b1a-7c3d-4e5f-8a9b-1c2d3e4f5a6b';

export const PUSH_BATCH = 50;
export const PULL_PAGE = 100;
export const MAX_CIPHERTEXT_CHARS = 1_000_000;

export const META = {
  deviceId: 'device_id',
  journalSource: 'journal_source',
  vaultId: 'vault_id',
  salt: 'salt',
  kdf: 'kdf',
  kdfParams: 'kdf_params',
  wrappedKey: 'wrapped_key',
  wrappedKeyNonce: 'wrapped_key_nonce',
  cursorSeq: 'cursor_seq',
  cursorHash: 'cursor_hash',
  pendingVault: 'pending_vault',
  pendingReset: 'pending_reset',
} as const;

export const JOURNAL_SOURCE_LOCAL = 'local';
export const JOURNAL_SOURCE_REMOTE = 'remote';
