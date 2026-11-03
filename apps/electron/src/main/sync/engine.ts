import { randomBytes, randomUUID } from 'node:crypto'

import {
  openRecord,
  sealRecord,
  toBase64,
  fromBase64,
  deriveWrappingKey,
  unwrapDataKey,
  mintVault
} from './crypto'
import {
  CryptoAuthError,
  SyncChainError,
  SyncDecryptError,
  SyncOfflineError,
  SyncRequestError,
  SyncVaultExistsError,
  SyncVaultResetError
} from './errors'
import type { JournalStore, PendingOp, StoredRecord } from './journal'
import { mergeRecord } from './merge'
import { canonicalizeFields, decodePayload, encodePayload, type JsonValue } from './payload'
import {
  CIPHERTEXT_MAX_CHARS,
  DEFAULT_KDF_PARAMS,
  GENESIS_HASH,
  NONCE_BYTES,
  PULL_PAGE_LIMIT,
  PUSH_BATCH_LIMIT,
  assertUuid,
  type KdfParams,
  type RecordKind
} from './protocol'
import { verifyChain } from './chain'
import type { PutVaultBody, SyncTransport, VaultDocument, WireOp } from './transport'

const META = {
  deviceId: 'device_id',
  vaultId: 'vault_id',
  cursor: 'cursor_seq',
  headHash: 'head_hash',
  salt: 'salt',
  kdfParams: 'kdf_params',
  wrappedKey: 'wrapped_key',
  wrappedKeyNonce: 'wrapped_key_nonce',
  pendingServerReset: 'pending_server_reset',
  lastSyncedAt: 'last_synced_at'
} as const

export interface SyncReport {
  pushed: number
  pulled: number
  cursor: number
  offline: boolean
}

export interface EngineStatus {
  unlocked: boolean
  hasLocalVault: boolean
  vaultId: string | null
  deviceId: string
  cursor: number
  headHash: string
  pendingCount: number
  dirtyCount: number
  lastSyncedAt: string | null
  pendingServerReset: boolean
}

export interface RecordDraft {
  recordId?: string
  kind: RecordKind
  fields: { [key: string]: JsonValue }
}

export interface SyncEngineOptions {
  now?: () => string
  randomUUID?: () => string
  randomBytes?: (size: number) => Buffer
}

/**
 * Headless sync client. Plaintext journal rows live in `store`. The data key
 * lives only in this object's memory after unlock. Network access goes through `transport`.
 */
export class SyncEngine {
  private dataKey: Buffer | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private readonly now: () => string
  private readonly newId: () => string
  private readonly newBytes: (size: number) => Buffer

  constructor(
    private readonly store: JournalStore,
    private readonly transport: SyncTransport,
    options: SyncEngineOptions = {}
  ) {
    this.now = options.now ?? ((): string => new Date().toISOString())
    this.newId = options.randomUUID ?? randomUUID
    this.newBytes = options.randomBytes ?? randomBytes
    if (!this.store.getMeta(META.deviceId)) {
      const deviceId = this.newId()
      assertUuid(deviceId, 'deviceId')
      this.store.setMeta(META.deviceId, deviceId)
    }
    if (!this.store.getMeta(META.cursor)) this.store.setMeta(META.cursor, '0')
    if (!this.store.getMeta(META.headHash)) this.store.setMeta(META.headHash, GENESIS_HASH)
  }

  deviceId(): string {
    const id = this.store.getMeta(META.deviceId)
    if (!id) throw new Error('device id is missing')
    return id
  }

  isUnlocked(): boolean {
    return this.dataKey !== null
  }

  hasLocalVault(): boolean {
    return this.store.getMeta(META.wrappedKey) !== null
  }

  lock(): void {
    if (this.dataKey) {
      this.dataKey.fill(0)
      this.dataKey = null
    }
  }

  status(): EngineStatus {
    const records = this.store.listRecords()
    return {
      unlocked: this.isUnlocked(),
      hasLocalVault: this.hasLocalVault(),
      vaultId: this.store.getMeta(META.vaultId),
      deviceId: this.deviceId(),
      cursor: this.cursor(),
      headHash: this.headHash(),
      pendingCount: this.store.listPending().length,
      dirtyCount: records.filter((record) => record.dirty).length,
      lastSyncedAt: this.store.getMeta(META.lastSyncedAt),
      pendingServerReset: this.store.getMeta(META.pendingServerReset) === '1'
    }
  }

  listRecords(kind?: RecordKind, includeDeleted = false): StoredRecord[] {
    return this.store
      .listRecords()
      .filter((record) => (kind ? record.kind === kind : true))
      .filter((record) => includeDeleted || !record.deleted)
  }

  upsertRecord(draft: RecordDraft): StoredRecord {
    this.requireKey()
    const existing = draft.recordId ? this.store.getRecord(draft.recordId) : null
    if (draft.recordId) assertUuid(draft.recordId, 'recordId')
    if (existing && existing.kind !== draft.kind) {
      throw new Error('record kind cannot change')
    }
    const recordId = existing?.recordId ?? draft.recordId ?? this.newId()
    assertUuid(recordId, 'recordId')
    const fields = this.stampFields(draft.kind, draft.fields, existing)
    const record: StoredRecord = {
      recordId,
      kind: draft.kind,
      deleted: false,
      updatedAt: this.now(),
      originSeq: existing?.originSeq ?? 0,
      originDeviceId: existing?.originDeviceId ?? this.deviceId(),
      fields,
      dirty: true
    }
    this.store.putRecord(record)
    return record
  }

  deleteRecord(recordId: string): StoredRecord | null {
    this.requireKey()
    const existing = this.store.getRecord(recordId)
    if (!existing || existing.deleted) return existing
    const record: StoredRecord = {
      ...existing,
      deleted: true,
      fields: {},
      updatedAt: this.now(),
      dirty: true
    }
    this.store.putRecord(record)
    return record
  }

  /**
   * Ask the server whether a vault exists. A vault is cached so a later unlock
   * works offline. An existing local vault is left alone.
   */
  async discover(): Promise<'none' | 'ready' | 'offline'> {
    if (this.hasLocalVault()) return 'ready'
    try {
      const vault = await this.call(() => this.transport.getVault())
      if (!vault) return 'none'
      this.rememberVault(vault)
      return 'ready'
    } catch (error) {
      if (error instanceof SyncOfflineError) return 'offline'
      throw error
    }
  }

  /** Create a wrapped data key locally and register it when the network is up. */
  async setup(passphrase: string): Promise<SyncReport> {
    if (this.hasLocalVault()) throw new Error('this device already has a vault')
    const minted = mintVault(passphrase, DEFAULT_KDF_PARAMS)
    this.storeSecrets(minted)
    this.store.setMeta(META.cursor, '0')
    this.store.setMeta(META.headHash, GENESIS_HASH)
    return this.sync()
  }

  async unlock(passphrase: string): Promise<void> {
    const body = this.readPutBody()
    const wrappingKey = deriveWrappingKey(passphrase, fromBase64(body.salt), body.kdfParams)
    this.dataKey = unwrapDataKey(
      wrappingKey,
      fromBase64(body.wrappedKey),
      fromBase64(body.wrappedKeyNonce)
    )
  }

  /**
   * New data key and passphrase. Local rows are kept and re-uploaded.
   * When a server vault id is already known, the next sync retires it.
   */
  async reset(passphrase: string): Promise<SyncReport> {
    const minted = mintVault(passphrase, DEFAULT_KDF_PARAMS)
    this.storeSecrets(minted)
    this.store.setMeta(META.pendingServerReset, '1')
    this.rewindLocalChain()
    return this.sync()
  }

  /** Retire the server vault and upload this device's plaintext with the current data key. */
  async replaceServerWithLocal(): Promise<SyncReport> {
    this.requireKey()
    if (!this.hasLocalVault()) throw new Error('this device has no vault')
    this.store.setMeta(META.pendingServerReset, '1')
    this.rewindLocalChain()
    return this.sync()
  }

  /**
   * Check the passphrase against the server vault, then drop the local journal
   * and download that vault. A wrong passphrase throws before anything is deleted.
   */
  async discardAndJoin(passphrase: string): Promise<SyncReport> {
    const vault = await this.call(() => this.transport.getVault())
    if (!vault) throw new Error('server has no vault')
    const wrappingKey = deriveWrappingKey(passphrase, fromBase64(vault.salt), vault.kdfParams)
    const dataKey = unwrapDataKey(
      wrappingKey,
      fromBase64(vault.wrappedKey),
      fromBase64(vault.wrappedKeyNonce)
    )
    this.store.clearRecords()
    this.store.clearPending()
    this.rememberVault(vault)
    this.store.setMeta(META.cursor, '0')
    this.store.setMeta(META.headHash, GENESIS_HASH)
    this.store.setMeta(META.pendingServerReset, '0')
    this.dataKey = dataKey
    return this.sync()
  }

  sync(): Promise<SyncReport> {
    return this.enqueue(() => this.syncOnce())
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async syncOnce(): Promise<SyncReport> {
    this.requireKey()
    let pushed = 0
    let pulled = 0
    try {
      await this.ensureRegistered()
      pulled += await this.pullAndApply()
      pushed += await this.pushPending()
      pulled += await this.pullAndApply()
      if (this.dirtyRemaining()) {
        pushed += await this.pushPending()
        pulled += await this.pullAndApply()
      }
      this.store.setMeta(META.lastSyncedAt, this.now())
      return { pushed, pulled, cursor: this.cursor(), offline: false }
    } catch (error) {
      if (error instanceof SyncOfflineError) {
        return { pushed, pulled, cursor: this.cursor(), offline: true }
      }
      throw error
    }
  }

  private async ensureRegistered(): Promise<void> {
    const body = this.readPutBody()
    if (this.store.getMeta(META.pendingServerReset) === '1') {
      try {
        const vault = await this.call(() => this.transport.resetVault(body))
        this.rememberVault(vault)
        this.store.setMeta(META.cursor, '0')
        this.store.setMeta(META.headHash, GENESIS_HASH)
        this.store.setMeta(META.pendingServerReset, '0')
        return
      } catch (error) {
        if (error instanceof SyncRequestError && error.status === 404) {
          this.store.deleteMeta(META.vaultId)
          this.store.setMeta(META.pendingServerReset, '0')
        } else {
          throw error
        }
      }
    }
    if (!this.store.getMeta(META.vaultId)) {
      const vault = await this.call(() => this.transport.putVault(body))
      this.rememberVault(vault)
    }
  }

  private async pullAndApply(): Promise<number> {
    const { ops, headHash } = await this.pullVerified()
    if (ops.length === 0) return 0
    const key = this.requireKey()
    const decoded = ops.map((op) => {
      let plaintext: string
      try {
        plaintext = openRecord(key, op.recordId, fromBase64(op.ciphertext), fromBase64(op.nonce))
      } catch (error) {
        if (error instanceof CryptoAuthError) {
          throw new SyncDecryptError(`authentication failed for seq ${op.seq}`)
        }
        throw error
      }
      try {
        return { op, payload: decodePayload(plaintext, op.recordId) }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'bad payload'
        throw new SyncDecryptError(`${message} at seq ${op.seq}`)
      }
    })
    this.store.transaction(() => {
      for (const { op, payload } of decoded) {
        const pending = this.store.getPendingForRecord(op.recordId)
        if (pending && pending.clientOpId === op.clientOpId) {
          this.store.deletePending(pending.clientOpId)
        }
        const incoming: StoredRecord = {
          recordId: op.recordId,
          kind: payload.kind,
          deleted: payload.deleted,
          updatedAt: payload.updatedAt,
          originSeq: op.seq,
          originDeviceId: op.deviceId,
          fields: payload.fields,
          dirty: false
        }
        const local = this.store.getRecord(op.recordId)
        this.store.putRecord(mergeRecord(local, incoming, this.deviceId()))
      }
      const last = decoded[decoded.length - 1]?.op
      if (!last) return
      this.store.setMeta(META.cursor, String(last.seq))
      this.store.setMeta(META.headHash, headHash)
    })
    return ops.length
  }

  private async pullVerified(): Promise<{ ops: WireOp[]; headHash: string }> {
    const vaultId = this.requireVaultId()
    const collected: WireOp[] = []
    for (let spin = 0; spin < 1000; spin += 1) {
      const head = await this.call(() => this.transport.getHead())
      if (head.vaultId !== vaultId) throw new SyncVaultResetError()
      let covered = collected.length > 0 ? collected[collected.length - 1].seq : this.cursor()
      while (covered < head.headSeq) {
        const page = await this.call(() =>
          this.transport.pullOps({ vaultId, after: covered, limit: PULL_PAGE_LIMIT })
        )
        if (page.ops.length === 0) {
          throw new SyncChainError(`server head is ${head.headSeq} but no ops followed ${covered}`)
        }
        for (const op of page.ops) {
          collected.push(op)
          covered = op.seq
        }
      }
      const refreshed = await this.call(() => this.transport.getHead())
      if (refreshed.vaultId !== vaultId) throw new SyncVaultResetError()
      if (refreshed.headSeq > covered) continue
      if (refreshed.headSeq < covered) {
        throw new SyncChainError('server head moved behind ops already pulled')
      }
      const verified = verifyChain(this.headHash(), this.cursor(), collected, refreshed.headHash)
      if (!verified.ok) throw new SyncChainError(verified.reason)
      return { ops: collected, headHash: verified.headHash }
    }
    throw new SyncChainError('pull did not settle on a head')
  }

  private async pushPending(): Promise<number> {
    this.sealDirty()
    const vaultId = this.store.getMeta(META.vaultId)
    if (!vaultId) return 0
    const pending = this.store.listPending()
    let pushed = 0
    for (let offset = 0; offset < pending.length; offset += PUSH_BATCH_LIMIT) {
      const batch = pending.slice(offset, offset + PUSH_BATCH_LIMIT)
      for (const op of batch) {
        if (op.ciphertext.length > CIPHERTEXT_MAX_CHARS) {
          throw new Error(`record ${op.recordId} is too large to sync`)
        }
      }
      await this.call(() =>
        this.transport.pushOps({
          vaultId,
          ops: batch.map((op) => ({
            clientOpId: op.clientOpId,
            recordId: op.recordId,
            deviceId: op.deviceId,
            nonce: op.nonce,
            ciphertext: op.ciphertext
          }))
        })
      )
      pushed += batch.length
    }
    return pushed
  }

  private sealDirty(): void {
    const key = this.requireKey()
    const deviceId = this.deviceId()
    for (const record of this.store.listRecords()) {
      if (!record.dirty || this.store.getPendingForRecord(record.recordId)) continue
      const plaintext = encodePayload({
        v: 1,
        kind: record.kind,
        recordId: record.recordId,
        deleted: record.deleted,
        updatedAt: record.updatedAt,
        fields: record.fields
      })
      const nonce = this.newBytes(NONCE_BYTES)
      const sealed = sealRecord(key, record.recordId, plaintext, nonce)
      const op: PendingOp = {
        clientOpId: this.newId(),
        recordId: record.recordId,
        deviceId,
        nonce: toBase64(nonce),
        ciphertext: toBase64(sealed),
        sealedUpdatedAt: record.updatedAt
      }
      assertUuid(op.clientOpId, 'clientOpId')
      this.store.savePending(op)
    }
  }

  private stampFields(
    kind: RecordKind,
    patch: { [key: string]: JsonValue },
    existing: StoredRecord | null
  ): { [key: string]: JsonValue } {
    const merged: { [key: string]: JsonValue } = { ...(existing?.fields ?? {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete merged[key]
      else merged[key] = value
    }
    if (kind === 'todo') {
      if (typeof merged.title !== 'string') merged.title = ''
      if (typeof merged.createdAt !== 'string') merged.createdAt = this.now()
      if (typeof merged.done !== 'boolean') merged.done = false
      if (typeof merged.isAllDay !== 'boolean') merged.isAllDay = false
    } else if (kind === 'note') {
      if (typeof merged.title !== 'string') merged.title = ''
      if (typeof merged.createdAt !== 'string') merged.createdAt = this.now()
      if (typeof merged.pinned !== 'boolean') merged.pinned = false
    } else if (typeof merged.body !== 'string') {
      merged.body = ''
      if (typeof merged.postedAt !== 'string') merged.postedAt = this.now()
    } else if (typeof merged.postedAt !== 'string') {
      merged.postedAt = this.now()
    }
    return canonicalizeFields(kind, merged, false)
  }

  private rewindLocalChain(): void {
    this.store.setMeta(META.cursor, '0')
    this.store.setMeta(META.headHash, GENESIS_HASH)
    this.store.clearPending()
    for (const record of this.store.listRecords()) {
      if (!record.dirty) this.store.putRecord({ ...record, dirty: true })
    }
  }

  private dirtyRemaining(): boolean {
    return (
      this.store.listPending().length > 0 || this.store.listRecords().some((record) => record.dirty)
    )
  }

  private rememberVault(vault: VaultDocument): void {
    const params: KdfParams = {
      N: vault.kdfParams.N,
      r: vault.kdfParams.r,
      p: vault.kdfParams.p,
      keyLen: vault.kdfParams.keyLen ?? 32
    }
    this.store.setMeta(META.salt, vault.salt)
    this.store.setMeta(META.kdfParams, JSON.stringify(params))
    this.store.setMeta(META.wrappedKey, vault.wrappedKey)
    this.store.setMeta(META.wrappedKeyNonce, vault.wrappedKeyNonce)
    this.store.setMeta(META.vaultId, vault.vaultId)
  }

  private storeSecrets(minted: ReturnType<typeof mintVault>): void {
    this.dataKey = minted.dataKey
    this.store.setMeta(META.salt, toBase64(minted.salt))
    this.store.setMeta(META.kdfParams, JSON.stringify(minted.kdfParams))
    this.store.setMeta(META.wrappedKey, toBase64(minted.wrappedKey))
    this.store.setMeta(META.wrappedKeyNonce, toBase64(minted.wrapNonce))
  }

  private readPutBody(): PutVaultBody {
    const salt = this.store.getMeta(META.salt)
    const kdfParams = this.store.getMeta(META.kdfParams)
    const wrappedKey = this.store.getMeta(META.wrappedKey)
    const wrappedKeyNonce = this.store.getMeta(META.wrappedKeyNonce)
    if (!salt || !kdfParams || !wrappedKey || !wrappedKeyNonce) {
      throw new Error('this device has no vault')
    }
    return {
      salt,
      kdf: 'scrypt',
      kdfParams: JSON.parse(kdfParams) as KdfParams,
      wrappedKey,
      wrappedKeyNonce
    }
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof SyncRequestError && error.status === 0) {
        throw new SyncOfflineError(error.message)
      }
      if (
        error instanceof SyncRequestError &&
        error.status === 409 &&
        error.code === 'vault_exists'
      ) {
        throw new SyncVaultExistsError(error.message)
      }
      if (
        error instanceof SyncRequestError &&
        error.status === 409 &&
        error.code === 'vault_reset'
      ) {
        throw new SyncVaultResetError(error.message)
      }
      throw error
    }
  }

  private requireKey(): Buffer {
    if (!this.dataKey) throw new Error('vault is locked')
    return this.dataKey
  }

  private requireVaultId(): string {
    const vaultId = this.store.getMeta(META.vaultId)
    if (!vaultId) throw new Error('vault is not registered')
    return vaultId
  }

  private cursor(): number {
    const raw = this.store.getMeta(META.cursor)
    const parsed = raw === null ? 0 : Number(raw)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
  }

  private headHash(): string {
    return this.store.getMeta(META.headHash) ?? GENESIS_HASH
  }
}
