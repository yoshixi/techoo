import { DatabaseSync } from 'node:sqlite'

import type { JsonValue } from './payload'
import type { RecordKind } from './protocol'
import type { MergeRecord } from './merge'

export interface PendingOp {
  clientOpId: string
  recordId: string
  deviceId: string
  nonce: string
  ciphertext: string
  sealedUpdatedAt: string
}

export type StoredRecord = MergeRecord

export interface JournalStore {
  getMeta(key: string): string | null
  setMeta(key: string, value: string): void
  deleteMeta(key: string): void
  getRecord(recordId: string): StoredRecord | null
  listRecords(): StoredRecord[]
  putRecord(record: StoredRecord): void
  listPending(): PendingOp[]
  getPendingForRecord(recordId: string): PendingOp | null
  savePending(op: PendingOp): void
  deletePending(clientOpId: string): void
  clearPending(): void
  clearRecords(): void
  transaction<T>(fn: () => T): T
  close(): void
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_records (
  record_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  deleted INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  origin_seq INTEGER NOT NULL,
  origin_device_id TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  dirty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_op_id TEXT NOT NULL UNIQUE,
  record_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  sealed_updated_at TEXT NOT NULL
);
`

interface RecordRow {
  record_id: string
  kind: string
  deleted: number
  updated_at: string
  origin_seq: number
  origin_device_id: string
  fields_json: string
  dirty: number
}

interface PendingRow {
  client_op_id: string
  record_id: string
  device_id: string
  nonce: string
  ciphertext: string
  sealed_updated_at: string
}

function rowToRecord(row: RecordRow): StoredRecord {
  const kind = row.kind
  if (kind !== 'todo' && kind !== 'post' && kind !== 'note') {
    throw new Error(`stored record has unknown kind ${row.kind}`)
  }
  return {
    recordId: row.record_id,
    kind,
    deleted: row.deleted !== 0,
    updatedAt: row.updated_at,
    originSeq: row.origin_seq,
    originDeviceId: row.origin_device_id,
    fields: JSON.parse(row.fields_json) as { [key: string]: JsonValue },
    dirty: row.dirty !== 0
  }
}

function rowToPending(row: PendingRow): PendingOp {
  return {
    clientOpId: row.client_op_id,
    recordId: row.record_id,
    deviceId: row.device_id,
    nonce: row.nonce,
    ciphertext: row.ciphertext,
    sealedUpdatedAt: row.sealed_updated_at
  }
}

export class SqliteJournalStore implements JournalStore {
  private readonly db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  static open(path: string): SqliteJournalStore {
    const db = new DatabaseSync(path)
    if (path !== ':memory:') {
      db.exec('PRAGMA journal_mode = WAL')
    }
    return new SqliteJournalStore(db)
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }

  deleteMeta(key: string): void {
    this.db.prepare('DELETE FROM sync_meta WHERE key = ?').run(key)
  }

  getRecord(recordId: string): StoredRecord | null {
    const row = this.db
      .prepare('SELECT * FROM journal_records WHERE record_id = ?')
      .get(recordId) as RecordRow | undefined
    return row ? rowToRecord(row) : null
  }

  listRecords(): StoredRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM journal_records ORDER BY updated_at, record_id')
      .all() as unknown as RecordRow[]
    return rows.map(rowToRecord)
  }

  putRecord(record: StoredRecord): void {
    this.db
      .prepare(
        `INSERT INTO journal_records (
        record_id, kind, deleted, updated_at, origin_seq, origin_device_id, fields_json, dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET
        kind = excluded.kind,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        origin_seq = excluded.origin_seq,
        origin_device_id = excluded.origin_device_id,
        fields_json = excluded.fields_json,
        dirty = excluded.dirty`
      )
      .run(
        record.recordId,
        record.kind,
        record.deleted ? 1 : 0,
        record.updatedAt,
        record.originSeq,
        record.originDeviceId,
        JSON.stringify(record.fields),
        record.dirty ? 1 : 0
      )
  }

  listPending(): PendingOp[] {
    const rows = this.db
      .prepare('SELECT * FROM pending_ops ORDER BY id')
      .all() as unknown as PendingRow[]
    return rows.map(rowToPending)
  }

  getPendingForRecord(recordId: string): PendingOp | null {
    const row = this.db.prepare('SELECT * FROM pending_ops WHERE record_id = ?').get(recordId) as
      | PendingRow
      | undefined
    return row ? rowToPending(row) : null
  }

  savePending(op: PendingOp): void {
    this.db
      .prepare('DELETE FROM pending_ops WHERE record_id = ? AND client_op_id <> ?')
      .run(op.recordId, op.clientOpId)
    this.db
      .prepare(
        `INSERT INTO pending_ops (client_op_id, record_id, device_id, nonce, ciphertext, sealed_updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_op_id) DO UPDATE SET
         record_id = excluded.record_id,
         device_id = excluded.device_id,
         nonce = excluded.nonce,
         ciphertext = excluded.ciphertext,
         sealed_updated_at = excluded.sealed_updated_at`
      )
      .run(op.clientOpId, op.recordId, op.deviceId, op.nonce, op.ciphertext, op.sealedUpdatedAt)
  }

  deletePending(clientOpId: string): void {
    this.db.prepare('DELETE FROM pending_ops WHERE client_op_id = ?').run(clientOpId)
  }

  clearPending(): void {
    this.db.exec('DELETE FROM pending_ops')
  }

  clearRecords(): void {
    this.db.exec('DELETE FROM journal_records')
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.db.close()
  }
}

export class MemoryJournalStore implements JournalStore {
  private meta = new Map<string, string>()
  private records = new Map<string, StoredRecord>()
  private pending: PendingOp[] = []

  getMeta(key: string): string | null {
    return this.meta.get(key) ?? null
  }

  setMeta(key: string, value: string): void {
    this.meta.set(key, value)
  }

  deleteMeta(key: string): void {
    this.meta.delete(key)
  }

  getRecord(recordId: string): StoredRecord | null {
    const record = this.records.get(recordId)
    return record ? { ...record, fields: { ...record.fields } } : null
  }

  listRecords(): StoredRecord[] {
    return [...this.records.values()]
      .map((record) => ({ ...record, fields: { ...record.fields } }))
      .sort(
        (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.recordId.localeCompare(b.recordId)
      )
  }

  putRecord(record: StoredRecord): void {
    this.records.set(record.recordId, { ...record, fields: { ...record.fields } })
  }

  listPending(): PendingOp[] {
    return this.pending.map((op) => ({ ...op }))
  }

  getPendingForRecord(recordId: string): PendingOp | null {
    const op = this.pending.find((entry) => entry.recordId === recordId)
    return op ? { ...op } : null
  }

  savePending(op: PendingOp): void {
    this.pending = this.pending.filter(
      (entry) => entry.clientOpId !== op.clientOpId && entry.recordId !== op.recordId
    )
    this.pending.push({ ...op })
  }

  deletePending(clientOpId: string): void {
    this.pending = this.pending.filter((entry) => entry.clientOpId !== clientOpId)
  }

  clearPending(): void {
    this.pending = []
  }

  clearRecords(): void {
    this.records.clear()
  }

  transaction<T>(fn: () => T): T {
    const meta = new Map(this.meta)
    const records = new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        { ...record, fields: { ...record.fields } }
      ])
    )
    const pending = this.pending.map((op) => ({ ...op }))
    try {
      return fn()
    } catch (error) {
      this.meta = meta
      this.records = records
      this.pending = pending
      throw error
    }
  }

  close(): void {
    this.meta.clear()
    this.records.clear()
    this.pending = []
  }
}

export function cloneRecord(record: StoredRecord): StoredRecord {
  return { ...record, fields: { ...record.fields } }
}

export function isRecordKind(value: string): value is RecordKind {
  return value === 'todo' || value === 'post' || value === 'note'
}
