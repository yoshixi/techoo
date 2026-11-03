/**
 * Headless entry point for techoo encrypted sync.
 *
 * Import this module from plain Node. It does not import Electron.
 *
 *   import { SyncEngine, createFetchTransport, SqliteJournalStore } from './index'
 */

export {
  CIPHERTEXT_MAX_CHARS,
  DATA_KEY_BYTES,
  DEFAULT_KDF_PARAMS,
  GENESIS_HASH,
  GCM_TAG_BYTES,
  ISO_TIMESTAMP,
  NONCE_BYTES,
  PROTOCOL_ID,
  PULL_PAGE_LIMIT,
  PUSH_BATCH_LIMIT,
  RECORD_AAD_PREFIX,
  RECORD_KINDS,
  SALT_BYTES,
  UUID_PATTERN,
  WRAP_AAD,
  assertTimestamp,
  assertUuid,
  recordAad,
  resolveKeyLen
} from './protocol'
export type { KdfParams, RecordKind } from './protocol'

export {
  CryptoAuthError,
  SyncChainError,
  SyncDecryptError,
  SyncOfflineError,
  SyncRequestError,
  SyncVaultExistsError,
  SyncVaultResetError,
  isOfflineError
} from './errors'

export {
  chainHash,
  chainPreimage,
  decryptAesGcm,
  deriveWrappingKey,
  encryptAesGcm,
  fromBase64,
  mintVault,
  openRecord,
  passphraseBytes,
  sealRecord,
  toBase64,
  unwrapDataKey,
  wrapDataKey
} from './crypto'
export type { MintedVault } from './crypto'

export { canonicalJson, canonicalizeFields, decodePayload, encodePayload } from './payload'
export type { JsonValue, SyncPayload } from './payload'

export { assertGenesis, verifyChain } from './chain'
export type { ChainLink, ChainVerification } from './chain'

export { compareVersions, foldRecords, mergeRecord, versionOf } from './merge'
export type { MergeRecord, MergeVersion } from './merge'

export { MemoryJournalStore, SqliteJournalStore } from './journal'
export type { JournalStore, PendingOp, StoredRecord } from './journal'

export { createFetchTransport, parseVaultDocument } from './transport'
export type {
  FetchTransportOptions,
  PutVaultBody,
  SyncHeadDocument,
  SyncTransport,
  VaultDocument,
  WireOp,
  WireOpInput,
  WirePushedOp
} from './transport'

export { SyncEngine } from './engine'
export type { EngineStatus, RecordDraft, SyncEngineOptions, SyncReport } from './engine'
