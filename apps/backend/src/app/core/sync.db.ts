import { GENESIS_HASH, KdfParamsModel, type PutVault, type PushedSyncOp, type SyncOp, type SyncOpInput, type VaultResponse } from './sync.core'

const PUSH_ATTEMPTS = 5

export interface SyncStatement {
  bind(...args: Array<string | number | null>): SyncStatement
  first<T extends Record<string, unknown>>(): Promise<T | null>
  all<T extends Record<string, unknown>>(): Promise<T[]>
  run(): Promise<{ changes: number }>
}

export interface SyncDatabase {
  prepare(sql: string): SyncStatement
  batch(statements: SyncStatement[]): Promise<void>
}

type VaultRow = {
  id: string
  salt: string
  kdf: string
  kdf_params: string
  wrapped_key: string
  wrapped_key_nonce: string
  head_seq: number | bigint
  head_hash: string
}

type OpRow = {
  seq: number | bigint
  client_op_id: string
  record_id: string
  device_id: string
  nonce: string
  ciphertext: string
  prev_hash: string
}

type Fail<Status extends 404 | 409 | 503, Code extends string> = {
  ok: false
  status: Status
  code: Code
}

export type VaultNotFound = Fail<404, 'vault_not_found'>
export type VaultExists = Fail<409, 'vault_exists'>
export type VaultReset = Fail<409, 'vault_reset'>
export type SyncConflict = Fail<503, 'sync_conflict'>

export type SyncFailure = VaultNotFound | VaultExists | VaultReset | SyncConflict

export type VaultResult = { ok: true; vault: VaultResponse } | SyncFailure

class D1SyncStatement implements SyncStatement {
  constructor(private prepared: D1PreparedStatement) {}

  bind(...args: Array<string | number | null>): SyncStatement {
    return new D1SyncStatement(this.prepared.bind(...args))
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    return this.prepared.first<T>()
  }

  async all<T extends Record<string, unknown>>(): Promise<T[]> {
    const result = await this.prepared.all<T>()
    return result.results
  }

  async run(): Promise<{ changes: number }> {
    const result = await this.prepared.run()
    return { changes: result.meta.changes ?? 0 }
  }

  unwrap(): D1PreparedStatement {
    return this.prepared
  }
}

/**
 * Every request starts on the primary so a sync cursor is not read from a stale replica.
 */
export function syncDatabaseFromD1(db: D1Database): SyncDatabase {
  const session = db.withSession('first-primary')
  return {
    prepare(sql: string): SyncStatement {
      return new D1SyncStatement(session.prepare(sql))
    },
    async batch(statements: SyncStatement[]): Promise<void> {
      const prepared = statements.map((statement) => {
        if (!(statement instanceof D1SyncStatement)) {
          throw new Error('D1 batch received a statement from another driver')
        }
        return statement.unwrap()
      })
      await session.batch(prepared)
    },
  }
}

export async function chainHash(
  prevHash: string,
  seq: number,
  recordId: string,
  ciphertext: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${prevHash}|${seq}|${recordId}|${ciphertext}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function asNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value
}

function isConstraintConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /division by zero|UNIQUE constraint failed|SQLITE_CONSTRAINT|database is locked|SQLITE_BUSY/i.test(message)
}

async function readActiveVault(db: SyncDatabase, userId: number): Promise<VaultRow | null> {
  return db.prepare(
    `SELECT id, salt, kdf, kdf_params, wrapped_key, wrapped_key_nonce, head_seq, head_hash
     FROM vaults
     WHERE user_id = ? AND retired_at IS NULL`,
  ).bind(userId).first<VaultRow>()
}

function toVaultResponse(row: VaultRow): VaultResponse {
  const kdfParams = KdfParamsModel.parse(JSON.parse(row.kdf_params))
  if (row.kdf !== 'scrypt') {
    throw new Error(`unsupported kdf: ${row.kdf}`)
  }
  return {
    vaultId: row.id,
    salt: row.salt,
    kdf: 'scrypt',
    kdfParams,
    wrappedKey: row.wrapped_key,
    wrappedKeyNonce: row.wrapped_key_nonce,
    headSeq: asNumber(row.head_seq),
    headHash: row.head_hash,
  }
}

export async function createVault(
  db: SyncDatabase,
  userId: number,
  input: PutVault,
): Promise<{ ok: true; vault: VaultResponse } | VaultExists> {
  const existing = await readActiveVault(db, userId)
  if (existing) {
    return { ok: false, status: 409, code: 'vault_exists' }
  }

  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  try {
    await db.prepare(
      `INSERT INTO vaults (
        id, user_id, salt, kdf, kdf_params, wrapped_key, wrapped_key_nonce, head_seq, head_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).bind(
      id,
      userId,
      input.salt,
      input.kdf,
      JSON.stringify(input.kdfParams),
      input.wrappedKey,
      input.wrappedKeyNonce,
      GENESIS_HASH,
      now,
    ).run()
  } catch (error) {
    if (isConstraintConflict(error)) {
      return { ok: false, status: 409, code: 'vault_exists' }
    }
    throw error
  }

  const created = await readActiveVault(db, userId)
  if (!created) {
    throw new Error('vault insert did not become readable')
  }
  return { ok: true, vault: toVaultResponse(created) }
}

export async function getVault(
  db: SyncDatabase,
  userId: number,
): Promise<{ ok: true; vault: VaultResponse } | VaultNotFound> {
  const row = await readActiveVault(db, userId)
  if (!row) return { ok: false, status: 404, code: 'vault_not_found' }
  return { ok: true, vault: toVaultResponse(row) }
}

export async function resetVault(
  db: SyncDatabase,
  userId: number,
  input: PutVault,
): Promise<{ ok: true; vault: VaultResponse } | VaultNotFound | VaultReset> {
  const current = await readActiveVault(db, userId)
  if (!current) return { ok: false, status: 404, code: 'vault_not_found' }

  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  try {
    await db.batch([
      db.prepare(
        `UPDATE vaults
         SET retired_at = CASE WHEN retired_at IS NULL THEN ? ELSE (1/0) END
         WHERE id = ?`,
      ).bind(now, current.id),
      db.prepare(
        `SELECT CASE
           WHEN (SELECT retired_at FROM vaults WHERE id = ?) IS NULL THEN (1/0)
           ELSE 1
         END`,
      ).bind(current.id),
      db.prepare(`DELETE FROM sync_ops WHERE vault_id = ?`).bind(current.id),
      db.prepare(
        `INSERT INTO vaults (
          id, user_id, salt, kdf, kdf_params, wrapped_key, wrapped_key_nonce, head_seq, head_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      ).bind(
        id,
        userId,
        input.salt,
        input.kdf,
        JSON.stringify(input.kdfParams),
        input.wrappedKey,
        input.wrappedKeyNonce,
        GENESIS_HASH,
        now,
      ),
    ])
  } catch (error) {
    if (isConstraintConflict(error)) {
      return { ok: false, status: 409, code: 'vault_reset' }
    }
    throw error
  }

  const created = await readActiveVault(db, userId)
  if (!created) {
    throw new Error('vault reset did not become readable')
  }
  return { ok: true, vault: toVaultResponse(created) }
}

async function requireActiveVault(
  db: SyncDatabase,
  userId: number,
  vaultId: string,
): Promise<{ ok: true; vault: VaultRow } | VaultNotFound | VaultReset> {
  const vault = await readActiveVault(db, userId)
  if (!vault) return { ok: false, status: 404, code: 'vault_not_found' }
  if (vault.id !== vaultId) return { ok: false, status: 409, code: 'vault_reset' }
  return { ok: true, vault }
}

async function tryPush(
  db: SyncDatabase,
  vault: VaultRow,
  ops: SyncOpInput[],
): Promise<{ ok: true; ops: PushedSyncOp[] } | 'retry'> {
  const placeholders = ops.map(() => '?').join(', ')
  const existing = await db.prepare(
    `SELECT client_op_id, seq, prev_hash
     FROM sync_ops
     WHERE vault_id = ? AND client_op_id IN (${placeholders})`,
  ).bind(vault.id, ...ops.map((op) => op.clientOpId)).all<OpRow>()

  const existingById = new Map(existing.map((row) => [row.client_op_id, row]))
  const fresh = ops.filter((op) => !existingById.has(op.clientOpId))

  if (fresh.length > 0) {
    let seq = asNumber(vault.head_seq)
    let prevHash = vault.head_hash
    const planned: Array<SyncOpInput & { seq: number; prevHash: string }> = []
    for (const op of fresh) {
      seq += 1
      const storedPrev = prevHash
      prevHash = await chainHash(storedPrev, seq, op.recordId, op.ciphertext)
      planned.push({ ...op, seq, prevHash: storedPrev })
    }

    const now = Math.floor(Date.now() / 1000)
    const expectedHead = asNumber(vault.head_seq)
    try {
      await db.batch([
        ...planned.map((op) => db.prepare(
          `INSERT INTO sync_ops (
            vault_id, seq, client_op_id, record_id, device_id, nonce, ciphertext, prev_hash, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          vault.id,
          op.seq,
          op.clientOpId,
          op.recordId,
          op.deviceId,
          op.nonce,
          op.ciphertext,
          op.prevHash,
          now,
        )),
        db.prepare(
          `UPDATE vaults
           SET head_seq = CASE WHEN head_seq = ? THEN ? ELSE (1/0) END,
               head_hash = CASE WHEN head_seq = ? THEN ? ELSE head_hash END
           WHERE id = ? AND retired_at IS NULL`,
        ).bind(expectedHead, seq, expectedHead, prevHash, vault.id),
        db.prepare(
          `SELECT CASE
             WHEN (SELECT head_seq FROM vaults WHERE id = ? AND retired_at IS NULL) = ?
             THEN 1
             ELSE (1/0)
           END`,
        ).bind(vault.id, seq),
      ])
    } catch (error) {
      if (isConstraintConflict(error)) return 'retry'
      throw error
    }
  }

  const seqById = new Map(existing.map((row) => [row.client_op_id, {
    seq: asNumber(row.seq),
    prevHash: row.prev_hash,
  }]))
  if (fresh.length > 0) {
    const written = await db.prepare(
      `SELECT client_op_id, seq, prev_hash
       FROM sync_ops
       WHERE vault_id = ? AND client_op_id IN (${placeholders})`,
    ).bind(vault.id, ...ops.map((op) => op.clientOpId)).all<OpRow>()
    for (const row of written) {
      seqById.set(row.client_op_id, { seq: asNumber(row.seq), prevHash: row.prev_hash })
    }
  }

  return {
    ok: true,
    ops: ops.map((op) => {
      const stored = seqById.get(op.clientOpId)
      if (!stored) throw new Error('pushed op was not readable')
      return { clientOpId: op.clientOpId, seq: stored.seq, prevHash: stored.prevHash }
    }),
  }
}

export async function pushOps(
  db: SyncDatabase,
  userId: number,
  vaultId: string,
  ops: SyncOpInput[],
): Promise<{ ok: true; ops: PushedSyncOp[] } | VaultNotFound | VaultReset | SyncConflict> {
  for (let attempt = 0; attempt < PUSH_ATTEMPTS; attempt++) {
    const vault = await requireActiveVault(db, userId, vaultId)
    if (!vault.ok) return vault
    const result = await tryPush(db, vault.vault, ops)
    if (result !== 'retry') return result
  }
  return { ok: false, status: 503, code: 'sync_conflict' }
}

export async function pullOps(
  db: SyncDatabase,
  userId: number,
  vaultId: string,
  after: number,
  limit: number,
): Promise<{ ok: true; ops: SyncOp[]; headSeq: number } | VaultNotFound | VaultReset> {
  const vault = await requireActiveVault(db, userId, vaultId)
  if (!vault.ok) return vault

  const rows = await db.prepare(
    `SELECT seq, client_op_id, record_id, device_id, nonce, ciphertext, prev_hash
     FROM sync_ops
     WHERE vault_id = ? AND seq > ?
     ORDER BY seq
     LIMIT ?`,
  ).bind(vaultId, after, limit).all<OpRow>()

  return {
    ok: true,
    headSeq: asNumber(vault.vault.head_seq),
    ops: rows.map((row) => ({
      seq: asNumber(row.seq),
      clientOpId: row.client_op_id,
      recordId: row.record_id,
      deviceId: row.device_id,
      nonce: row.nonce,
      ciphertext: row.ciphertext,
      prevHash: row.prev_hash,
    })),
  }
}

export async function getSyncHead(
  db: SyncDatabase,
  userId: number,
): Promise<{ ok: true; vaultId: string; headSeq: number; headHash: string } | VaultNotFound> {
  const vault = await getVault(db, userId)
  if (!vault.ok) return vault
  return {
    ok: true,
    vaultId: vault.vault.vaultId,
    headSeq: vault.vault.headSeq,
    headHash: vault.vault.headHash,
  }
}

export async function deleteUserSyncData(db: SyncDatabase, userId: number): Promise<void> {
  await db.batch([
    db.prepare(
      `DELETE FROM sync_ops WHERE vault_id IN (SELECT id FROM vaults WHERE user_id = ?)`,
    ).bind(userId),
    db.prepare(`DELETE FROM vaults WHERE user_id = ?`).bind(userId),
  ])
}
