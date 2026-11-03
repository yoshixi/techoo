import { z } from '@hono/zod-openapi'

/** SHA-256 hex of an empty chain. The first op stores this as prevHash. */
export const GENESIS_HASH = '0'.repeat(64)

const ENCRYPTED_SYNC_PREFIXES = ['/api/v1/vault', '/api/v1/sync'] as const

/** Vault and sync routes never open a Turso tenant database. */
export function isEncryptedSyncPath(path: string): boolean {
  return ENCRYPTED_SYNC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export const SYNC_ERROR = {
  unavailable: 'sync_unavailable',
  vaultExists: 'vault_exists',
  vaultNotFound: 'vault_not_found',
  vaultReset: 'vault_reset',
  conflict: 'sync_conflict',
  duplicateClientOp: 'duplicate_client_op',
} as const

const UuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Expected a UUID',
)

export const KdfParamsModel = z.object({
  N: z.number().int().min(1024).max(1_048_576),
  r: z.number().int().min(1).max(32),
  p: z.number().int().min(1).max(16),
  keyLen: z.number().int().min(16).max(64).optional(),
}).openapi('SyncKdfParams')

export const PutVaultModel = z.object({
  salt: z.string().min(1).max(256),
  kdf: z.literal('scrypt'),
  kdfParams: KdfParamsModel,
  wrappedKey: z.string().min(1).max(4096),
  wrappedKeyNonce: z.string().min(1).max(128),
}).openapi('PutVault')

export const VaultResponseModel = z.object({
  vaultId: UuidSchema,
  salt: z.string(),
  kdf: z.literal('scrypt'),
  kdfParams: KdfParamsModel,
  wrappedKey: z.string(),
  wrappedKeyNonce: z.string(),
  headSeq: z.number().int().nonnegative(),
  headHash: z.string(),
}).openapi('Vault')

export const SyncHeadResponseModel = z.object({
  vaultId: UuidSchema,
  headSeq: z.number().int().nonnegative(),
  headHash: z.string(),
}).openapi('SyncHead')

export const SyncOpInputModel = z.object({
  clientOpId: UuidSchema,
  recordId: UuidSchema,
  deviceId: UuidSchema,
  nonce: z.string().min(1).max(128),
  ciphertext: z.string().min(1).max(1_000_000),
}).openapi('SyncOpInput')

export const PushSyncOpsModel = z.object({
  vaultId: UuidSchema,
  ops: z.array(SyncOpInputModel).min(1).max(50),
}).openapi('PushSyncOps')

export const PushedSyncOpModel = z.object({
  clientOpId: UuidSchema,
  seq: z.number().int().positive(),
  prevHash: z.string(),
}).openapi('PushedSyncOp')

export const PushSyncOpsResponseModel = z.object({
  ops: z.array(PushedSyncOpModel),
}).openapi('PushSyncOpsResponse')

export const SyncOpModel = z.object({
  seq: z.number().int().positive(),
  clientOpId: UuidSchema,
  recordId: UuidSchema,
  deviceId: UuidSchema,
  nonce: z.string(),
  ciphertext: z.string(),
  prevHash: z.string(),
}).openapi('SyncOp')

export const PullSyncOpsQueryModel = z.object({
  vaultId: UuidSchema,
  after: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).openapi('PullSyncOpsQuery')

export const PullSyncOpsResponseModel = z.object({
  ops: z.array(SyncOpModel),
  headSeq: z.number().int().nonnegative(),
}).openapi('PullSyncOpsResponse')

export type PutVault = z.infer<typeof PutVaultModel>
export type VaultResponse = z.infer<typeof VaultResponseModel>
export type SyncOpInput = z.infer<typeof SyncOpInputModel>
export type PushedSyncOp = z.infer<typeof PushedSyncOpModel>
export type SyncOp = z.infer<typeof SyncOpModel>
