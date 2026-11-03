import { base64ToBytes, bytesToBase64 } from './bytes';
import { chainHash, verifyChain } from './chain';
import {
  decryptPlainRecord,
  deriveKek,
  encryptPlainRecord,
  unwrapDataKey,
  wrapDataKey,
} from './crypto';
import {
  DATA_KEY_BYTES,
  DEFAULT_KDF_PARAMS,
  GENESIS_HASH,
  KDF_NAME,
  MAX_CIPHERTEXT_CHARS,
  META,
  NONCE_BYTES,
  PULL_PAGE,
  PUSH_BATCH,
  SALT_BYTES,
} from './format';
import { uuidV4 } from './ids';
import { mergeRecord, type MergeVersion } from './merge';
import type {
  CryptoAdapter,
  JournalRecord,
  PlainRecord,
  PutVaultBody,
  RecordKind,
  SyncOpInput,
  SyncResult,
  SyncTransport,
  VaultMaterial,
} from './types';
import { SyncError, isOfflineError } from './types';
import type { SyncStore } from './store';

const LOCAL_ID_KINDS = new Set<RecordKind>(['todo', 'note', 'post', 'post_list']);

export type SyncEngineOptions = {
  store: SyncStore;
  transport: SyncTransport;
  crypto: CryptoAdapter;
  now?: () => Date;
};

export class SyncEngine {
  private dataKey: Uint8Array | null = null;
  lastResult: SyncResult | null = null;

  constructor(private readonly options: SyncEngineOptions) {}

  isUnlocked(): boolean {
    return this.dataKey != null;
  }

  lock(): void {
    this.dataKey = null;
  }

  nowIso(): string {
    return (this.options.now ?? (() => new Date()))().toISOString();
  }

  newId(): string {
    return uuidV4((length) => this.options.crypto.randomBytes(length));
  }

  async deviceId(): Promise<string> {
    const existing = await this.options.store.getMeta(META.deviceId);
    if (existing) return existing;
    const created = this.newId();
    await this.options.store.setMeta(META.deviceId, created);
    return created;
  }

  async createVault(passphrase: string): Promise<VaultMaterial> {
    this.requirePassphrase(passphrase);
    const wrapped = await this.wrapNewKey(passphrase);
    this.dataKey = wrapped.dataKey;
    await this.options.store.setMeta(META.pendingVault, JSON.stringify(wrapped.body));
    await this.options.store.setMeta(META.journalSource, 'local');
    await this.options.store.setMeta(META.cursorSeq, '0');
    await this.options.store.setMeta(META.cursorHash, GENESIS_HASH);
    await this.deviceId();
    try {
      await this.flushVaultRequest();
      await this.sync();
      return this.vaultView(wrapped.body);
    } catch (err) {
      if (isOfflineError(err)) return this.vaultView(wrapped.body);
      throw err;
    }
  }

  async unlock(passphrase: string): Promise<VaultMaterial> {
    this.requirePassphrase(passphrase);
    try {
      const vault = await this.options.transport.getVault();
      if (!vault) {
        const pending = await this.cachedVault();
        if (!pending) throw new SyncError('vault_not_found', 'No encrypted vault exists yet');
        this.dataKey = await this.openKey(passphrase, pending);
        return pending;
      }
      const localVaultId = await this.options.store.getMeta(META.vaultId);
      if (localVaultId && localVaultId !== vault.vaultId) {
        throw new SyncError('vault_reset', 'The vault was replaced from another device');
      }
      this.dataKey = await this.openKey(passphrase, vault);
      await this.rememberVault(vault, false);
      await this.sync();
      return vault;
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const cached = await this.cachedVault();
      if (!cached) throw err;
      this.dataKey = await this.openKey(passphrase, cached);
      return cached;
    }
  }

  async resetVault(passphrase: string): Promise<VaultMaterial> {
    this.requirePassphrase(passphrase);
    const wrapped = await this.wrapNewKey(passphrase);
    this.dataKey = wrapped.dataKey;
    await this.options.store.setMeta(META.pendingReset, JSON.stringify(wrapped.body));
    await this.options.store.setMeta(META.pendingVault, '');
    await this.options.store.setMeta(META.cursorSeq, '0');
    await this.options.store.setMeta(META.cursorHash, GENESIS_HASH);
    await this.options.store.markAllDirty();
    try {
      await this.flushVaultRequest();
      await this.sync();
      return this.vaultView(wrapped.body);
    } catch (err) {
      if (isOfflineError(err)) return this.vaultView(wrapped.body);
      throw err;
    }
  }

  /**
   * Another device reset the vault. Local plaintext is discarded and replaced
   * by whatever the new log decrypts to. The passphrase is checked first.
   */
  async replaceWithRemoteVault(passphrase: string): Promise<VaultMaterial> {
    this.requirePassphrase(passphrase);
    const vault = await this.options.transport.getVault();
    if (!vault) throw new SyncError('vault_not_found', 'No encrypted vault exists yet');
    this.dataKey = await this.openKey(passphrase, vault);
    await this.options.store.wipeRecords();
    await this.rememberVault(vault, true);
    await this.sync();
    return vault;
  }

  async sync(): Promise<SyncResult> {
    try {
      if (!this.dataKey) return await this.result('locked');
      await this.flushVaultRequest();
      const vaultId = await this.options.store.getMeta(META.vaultId);
      if (!vaultId) return await this.result('no_vault');
      const head = await this.options.transport.getHead();
      if (!head) return await this.result('no_vault');
      if (head.vaultId !== vaultId) return await this.result('vault_reset');
      await this.pull(vaultId, head.headSeq, head.headHash);
      await this.push(vaultId);
      const after = await this.options.transport.getHead();
      if (after && after.vaultId === vaultId)
        await this.pull(vaultId, after.headSeq, after.headHash);
      return await this.result('ok');
    } catch (err) {
      if (isOfflineError(err))
        return await this.result('offline', 'Offline. Changes stay on this device.');
      if (err instanceof SyncError && err.code === 'vault_reset')
        return await this.result('vault_reset', err.message);
      if (err instanceof SyncError) return await this.result('error', err.message);
      const message = err instanceof Error ? err.message : 'Sync failed';
      return await this.result('error', message);
    }
  }

  private async flushVaultRequest(): Promise<void> {
    const reset = await this.options.store.getMeta(META.pendingReset);
    if (reset) {
      const vault = await this.options.transport.resetVault(JSON.parse(reset) as PutVaultBody);
      await this.rememberVault(vault, true);
      await this.options.store.setMeta(META.pendingReset, '');
      await this.options.store.setMeta(META.pendingVault, '');
      return;
    }
    const pending = await this.options.store.getMeta(META.pendingVault);
    const vaultId = await this.options.store.getMeta(META.vaultId);
    if (pending && !vaultId) {
      const existing = await this.options.transport.getVault();
      if (existing) throw new SyncError('vault_exists', 'An encrypted vault already exists');
      const vault = await this.options.transport.putVault(JSON.parse(pending) as PutVaultBody);
      await this.rememberVault(vault, true);
      await this.options.store.setMeta(META.pendingVault, '');
    }
  }

  private async cachedVault(): Promise<VaultMaterial | null> {
    const pending = await this.options.store.getMeta(META.pendingVault);
    if (pending) return this.vaultView(JSON.parse(pending) as PutVaultBody);
    const salt = await this.options.store.getMeta(META.salt);
    const wrappedKey = await this.options.store.getMeta(META.wrappedKey);
    const wrappedKeyNonce = await this.options.store.getMeta(META.wrappedKeyNonce);
    const kdfParams = await this.options.store.getMeta(META.kdfParams);
    if (!salt || !wrappedKey || !wrappedKeyNonce || !kdfParams) return null;
    return {
      vaultId: (await this.options.store.getMeta(META.vaultId)) ?? '',
      salt,
      kdf: 'scrypt',
      kdfParams: JSON.parse(kdfParams) as VaultMaterial['kdfParams'],
      wrappedKey,
      wrappedKeyNonce,
      headSeq: Number((await this.options.store.getMeta(META.cursorSeq)) ?? '0'),
      headHash: (await this.options.store.getMeta(META.cursorHash)) ?? GENESIS_HASH,
    };
  }

  private async vaultView(body: PutVaultBody): Promise<VaultMaterial> {
    return {
      vaultId: (await this.options.store.getMeta(META.vaultId)) ?? '',
      ...body,
      headSeq: Number((await this.options.store.getMeta(META.cursorSeq)) ?? '0'),
      headHash: (await this.options.store.getMeta(META.cursorHash)) ?? GENESIS_HASH,
    };
  }

  private async pull(vaultId: string, headSeq: number, headHash: string): Promise<void> {
    const dataKey = this.requireKey();
    for (;;) {
      const cursor = await this.cursor();
      if (cursor.seq >= headSeq) {
        if (cursor.hash !== headHash) {
          throw new SyncError('chain_broken', 'Local chain head does not match the server');
        }
        return;
      }
      const page = await this.options.transport.pullOps({
        vaultId,
        after: cursor.seq,
        limit: PULL_PAGE,
      });
      if (page.ops.length === 0)
        throw new SyncError('chain_broken', 'The log skipped ahead of this cursor');
      const ordered = [...page.ops].sort((a, b) => a.seq - b.seq);
      const verified = await verifyChain(this.options.crypto, cursor, ordered);
      if (!verified.ok) throw new SyncError('chain_broken', verified.reason);
      for (const op of ordered) {
        const plain = await decryptPlainRecord(
          this.options.crypto,
          dataKey,
          op.recordId,
          op.nonce,
          op.ciphertext
        );
        await this.applyRemote(plain, op.seq, op.deviceId);
      }
      await this.options.store.setMeta(META.cursorSeq, String(verified.endSeq));
      await this.options.store.setMeta(META.cursorHash, verified.endHash);
    }
  }

  private async push(vaultId: string): Promise<void> {
    const dataKey = this.requireKey();
    const dirty = (await this.options.store.listDirty()).filter(
      (record) => record.kind === 'todo' || record.kind === 'note' || record.kind === 'post'
    );
    for (let offset = 0; offset < dirty.length; offset += PUSH_BATCH) {
      const batch = dirty.slice(offset, offset + PUSH_BATCH);
      const ops: SyncOpInput[] = [];
      for (const record of batch) {
        const prepared = await this.seal(record, dataKey);
        if (
          prepared.pendingCiphertext == null ||
          prepared.pendingCiphertext.length > MAX_CIPHERTEXT_CHARS
        ) {
          throw new SyncError('ciphertext_too_large', 'A record is too large to sync');
        }
        await this.options.store.saveRecord(prepared);
        ops.push({
          clientOpId: prepared.pendingClientOpId ?? '',
          recordId: prepared.recordId,
          deviceId: prepared.deviceId,
          nonce: prepared.pendingNonce ?? '',
          ciphertext: prepared.pendingCiphertext,
        });
      }
      const pushed = await this.options.transport.pushOps({ vaultId, ops });
      for (const ack of pushed.ops) {
        const current = await this.options.store.findByPendingOp(ack.clientOpId);
        if (!current) continue;
        const unchanged = current.pendingUpdatedAt === current.updatedAt;
        await this.options.store.saveRecord({
          ...current,
          dirty: unchanged ? false : current.dirty,
          lastSeq: unchanged ? ack.seq : current.lastSeq,
          pendingClientOpId: null,
          pendingNonce: null,
          pendingCiphertext: null,
          pendingUpdatedAt: null,
        });
      }
    }
  }

  private async seal(record: JournalRecord, dataKey: Uint8Array): Promise<JournalRecord> {
    if (
      record.pendingClientOpId &&
      record.pendingNonce &&
      record.pendingCiphertext &&
      record.pendingUpdatedAt === record.updatedAt
    ) {
      return record;
    }
    const nonce = this.options.crypto.randomBytes(NONCE_BYTES);
    const ciphertext = await encryptPlainRecord(
      this.options.crypto,
      dataKey,
      toPlain(record),
      nonce
    );
    return {
      ...record,
      pendingClientOpId: this.newId(),
      pendingNonce: bytesToBase64(nonce),
      pendingCiphertext: ciphertext,
      pendingUpdatedAt: record.updatedAt,
    };
  }

  private async applyRemote(plain: PlainRecord, seq: number, deviceId: string): Promise<void> {
    const existing = await this.options.store.getRecord(plain.recordId);
    const incoming: MergeVersion = {
      recordId: plain.recordId,
      kind: plain.kind,
      deleted: plain.deleted,
      updatedAt: plain.updatedAt,
      deviceId: deviceId.toLowerCase(),
      seq,
      fields: plain.fields,
    };
    const local = existing ? toMergeVersion(existing) : null;
    const outcome = mergeRecord(local, incoming);
    if (!outcome.applied) return;
    const localId =
      existing?.localId ??
      (LOCAL_ID_KINDS.has(plain.kind) ? await this.options.store.nextLocalId(plain.kind) : null);
    await this.options.store.saveRecord({
      recordId: plain.recordId,
      kind: plain.kind,
      localId,
      deleted: plain.deleted,
      updatedAt: plain.updatedAt,
      deviceId,
      fields: plain.fields,
      dirty: false,
      lastSeq: seq,
      pendingClientOpId: null,
      pendingNonce: null,
      pendingCiphertext: null,
      pendingUpdatedAt: null,
    });
  }

  private async wrapNewKey(
    passphrase: string
  ): Promise<{ body: PutVaultBody; dataKey: Uint8Array }> {
    const salt = this.options.crypto.randomBytes(SALT_BYTES);
    const dataKey = this.options.crypto.randomBytes(DATA_KEY_BYTES);
    const nonce = this.options.crypto.randomBytes(NONCE_BYTES);
    const kek = await deriveKek(this.options.crypto, passphrase, salt, DEFAULT_KDF_PARAMS);
    const wrappedKey = await wrapDataKey(this.options.crypto, kek, dataKey, nonce);
    return {
      dataKey,
      body: {
        salt: bytesToBase64(salt),
        kdf: KDF_NAME,
        kdfParams: { ...DEFAULT_KDF_PARAMS },
        wrappedKey,
        wrappedKeyNonce: bytesToBase64(nonce),
      },
    };
  }

  private async openKey(passphrase: string, vault: VaultMaterial): Promise<Uint8Array> {
    const kek = await deriveKek(
      this.options.crypto,
      passphrase,
      base64ToBytes(vault.salt),
      vault.kdfParams
    );
    return unwrapDataKey(this.options.crypto, kek, vault.wrappedKey, vault.wrappedKeyNonce);
  }

  private async rememberVault(vault: VaultMaterial, resetCursor: boolean): Promise<void> {
    const store = this.options.store;
    await store.setMeta(META.vaultId, vault.vaultId);
    await store.setMeta(META.salt, vault.salt);
    await store.setMeta(META.kdf, vault.kdf);
    await store.setMeta(META.kdfParams, JSON.stringify(vault.kdfParams));
    await store.setMeta(META.wrappedKey, vault.wrappedKey);
    await store.setMeta(META.wrappedKeyNonce, vault.wrappedKeyNonce);
    await store.setMeta(META.journalSource, 'local');
    if (resetCursor) {
      await store.setMeta(META.cursorSeq, '0');
      await store.setMeta(META.cursorHash, GENESIS_HASH);
    } else if ((await store.getMeta(META.cursorSeq)) == null) {
      await store.setMeta(META.cursorSeq, '0');
      await store.setMeta(META.cursorHash, GENESIS_HASH);
    }
    await this.deviceId();
  }

  private async cursor(): Promise<{ seq: number; hash: string }> {
    const seq = Number((await this.options.store.getMeta(META.cursorSeq)) ?? '0');
    const hash = (await this.options.store.getMeta(META.cursorHash)) ?? GENESIS_HASH;
    return { seq, hash };
  }

  private async result(status: SyncResult['status'], message?: string): Promise<SyncResult> {
    const cursor = Number((await this.options.store.getMeta(META.cursorSeq)) ?? '0');
    const pending = await this.options.store.countDirty();
    const value = { status, pending, cursor, message };
    this.lastResult = value;
    return value;
  }

  private requireKey(): Uint8Array {
    if (!this.dataKey) throw new SyncError('locked', 'Unlock the vault to sync');
    return this.dataKey;
  }

  private requirePassphrase(passphrase: string): void {
    if (!passphrase) throw new SyncError('passphrase', 'Passphrase is required');
  }
}

function toPlain(record: JournalRecord): PlainRecord {
  return {
    v: 1,
    kind: record.kind,
    recordId: record.recordId,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    fields: record.fields,
  };
}

function toMergeVersion(record: JournalRecord): MergeVersion {
  return {
    recordId: record.recordId,
    kind: record.kind,
    deleted: record.deleted,
    updatedAt: record.updatedAt,
    deviceId: record.deviceId,
    seq: record.lastSeq,
    fields: record.fields,
  };
}

export async function previewChainHash(
  crypto: CryptoAdapter,
  prevHash: string,
  seq: number,
  recordId: string,
  ciphertext: string
): Promise<string> {
  return chainHash(crypto, prevHash, seq, recordId, ciphertext);
}
