export type RecordKind =
  | 'todo'
  | 'note'
  | 'post'
  | 'post_list'
  | 'post_list_item'
  | 'post_favorite';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type KdfParams = {
  N: number;
  r: number;
  p: number;
  keyLen?: number;
};

export type VaultMaterial = {
  vaultId: string;
  salt: string;
  kdf: 'scrypt';
  kdfParams: KdfParams;
  wrappedKey: string;
  wrappedKeyNonce: string;
  headSeq: number;
  headHash: string;
};

export type PutVaultBody = {
  salt: string;
  kdf: 'scrypt';
  kdfParams: KdfParams;
  wrappedKey: string;
  wrappedKeyNonce: string;
};

export type SyncOpInput = {
  clientOpId: string;
  recordId: string;
  deviceId: string;
  nonce: string;
  ciphertext: string;
};

export type PushedOp = {
  clientOpId: string;
  seq: number;
  prevHash: string;
};

export type SyncOpWire = SyncOpInput & {
  seq: number;
  prevHash: string;
};

export type JournalRecord = {
  recordId: string;
  kind: RecordKind;
  localId: number | null;
  deleted: boolean;
  updatedAt: string;
  deviceId: string;
  fields: { [key: string]: JsonValue };
  dirty: boolean;
  lastSeq: number | null;
  pendingClientOpId: string | null;
  pendingNonce: string | null;
  pendingCiphertext: string | null;
  pendingUpdatedAt: string | null;
};

export type PlainRecord = {
  v: 1;
  kind: RecordKind;
  recordId: string;
  deleted: boolean;
  updatedAt: string;
  fields: { [key: string]: JsonValue };
};

export interface CryptoAdapter {
  randomBytes(length: number): Uint8Array;
  scrypt(
    password: Uint8Array,
    salt: Uint8Array,
    params: { N: number; r: number; p: number; dkLen: number }
  ): Promise<Uint8Array>;
  aesGcmEncrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad: Uint8Array
  ): Promise<Uint8Array>;
  aesGcmDecrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    aad: Uint8Array
  ): Promise<Uint8Array>;
  sha256(data: Uint8Array): Promise<Uint8Array>;
}

export interface SyncTransport {
  putVault(body: PutVaultBody): Promise<VaultMaterial>;
  getVault(): Promise<VaultMaterial | null>;
  resetVault(body: PutVaultBody): Promise<VaultMaterial>;
  getHead(): Promise<{ vaultId: string; headSeq: number; headHash: string } | null>;
  pushOps(body: { vaultId: string; ops: SyncOpInput[] }): Promise<{ ops: PushedOp[] }>;
  pullOps(query: {
    vaultId: string;
    after: number;
    limit: number;
  }): Promise<{ ops: SyncOpWire[]; headSeq: number }>;
}

export type SyncStatusName = 'ok' | 'locked' | 'offline' | 'no_vault' | 'vault_reset' | 'error';

export type SyncResult = {
  status: SyncStatusName;
  pending: number;
  cursor: number;
  message?: string;
};

export class SyncError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

export function isOfflineError(err: unknown): boolean {
  if (err instanceof SyncError) return err.code === 'offline';
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : '';
  return /network request failed|failed to fetch|network error|offline/i.test(message);
}
