import type { JournalRecord, JsonValue, RecordKind } from './types';

export type SqlValue = string | number | null;

export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export interface SyncStore {
  ensureSchema(): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  getRecord(recordId: string): Promise<JournalRecord | null>;
  findByPendingOp(clientOpId: string): Promise<JournalRecord | null>;
  listRecords(): Promise<JournalRecord[]>;
  listDirty(): Promise<JournalRecord[]>;
  saveRecord(record: JournalRecord): Promise<void>;
  nextLocalId(kind: RecordKind): Promise<number>;
  countDirty(): Promise<number>;
  markAllDirty(): Promise<void>;
  wipeRecords(): Promise<void>;
}

type Row = {
  record_id: string;
  kind: string;
  local_id: number | null;
  deleted: number;
  updated_at: string;
  device_id: string;
  fields_json: string;
  dirty: number;
  last_seq: number | null;
  pending_client_op_id: string | null;
  pending_nonce: string | null;
  pending_ciphertext: string | null;
  pending_updated_at: string | null;
};

export function recordToRow(record: JournalRecord): Row {
  return {
    record_id: record.recordId,
    kind: record.kind,
    local_id: record.localId,
    deleted: record.deleted ? 1 : 0,
    updated_at: record.updatedAt,
    device_id: record.deviceId,
    fields_json: JSON.stringify(record.fields),
    dirty: record.dirty ? 1 : 0,
    last_seq: record.lastSeq,
    pending_client_op_id: record.pendingClientOpId,
    pending_nonce: record.pendingNonce,
    pending_ciphertext: record.pendingCiphertext,
    pending_updated_at: record.pendingUpdatedAt,
  };
}

export function rowToRecord(row: Row): JournalRecord {
  return {
    recordId: row.record_id,
    kind: row.kind as RecordKind,
    localId: row.local_id,
    deleted: row.deleted === 1,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    fields: JSON.parse(row.fields_json) as { [key: string]: JsonValue },
    dirty: row.dirty === 1,
    lastSeq: row.last_seq,
    pendingClientOpId: row.pending_client_op_id,
    pendingNonce: row.pending_nonce,
    pendingCiphertext: row.pending_ciphertext,
    pendingUpdatedAt: row.pending_updated_at,
  };
}

export const JOURNAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_records (
  record_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  local_id INTEGER,
  deleted INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  dirty INTEGER NOT NULL,
  last_seq INTEGER,
  pending_client_op_id TEXT,
  pending_nonce TEXT,
  pending_ciphertext TEXT,
  pending_updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_records_kind_local
  ON journal_records(kind, local_id) WHERE local_id IS NOT NULL;
`;

const COLUMNS = `record_id, kind, local_id, deleted, updated_at, device_id, fields_json, dirty, last_seq,
  pending_client_op_id, pending_nonce, pending_ciphertext, pending_updated_at`;

function bindRecord(record: JournalRecord): SqlValue[] {
  const row = recordToRow(record);
  return [
    row.record_id,
    row.kind,
    row.local_id,
    row.deleted,
    row.updated_at,
    row.device_id,
    row.fields_json,
    row.dirty,
    row.last_seq,
    row.pending_client_op_id,
    row.pending_nonce,
    row.pending_ciphertext,
    row.pending_updated_at,
  ];
}

export function createSqliteSyncStore(db: SqlDatabase): SyncStore {
  return {
    async ensureSchema() {
      await db.exec(JOURNAL_SCHEMA);
    },
    async getMeta(key) {
      const row = await db.get<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [
        key,
      ]);
      return row?.value ?? null;
    },
    async setMeta(key, value) {
      await db.run(
        'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value]
      );
    },
    async getRecord(recordId) {
      const row = await db.get<Row>(`SELECT ${COLUMNS} FROM journal_records WHERE record_id = ?`, [
        recordId,
      ]);
      return row ? rowToRecord(row) : null;
    },
    async findByPendingOp(clientOpId) {
      const row = await db.get<Row>(
        `SELECT ${COLUMNS} FROM journal_records WHERE pending_client_op_id = ?`,
        [clientOpId]
      );
      return row ? rowToRecord(row) : null;
    },
    async listRecords() {
      const rows = await db.all<Row>(`SELECT ${COLUMNS} FROM journal_records`);
      return rows.map(rowToRecord);
    },
    async listDirty() {
      const rows = await db.all<Row>(
        `SELECT ${COLUMNS} FROM journal_records WHERE dirty = 1 ORDER BY updated_at ASC, record_id ASC`
      );
      return rows.map(rowToRecord);
    },
    async saveRecord(record) {
      await db.run(
        `INSERT INTO journal_records (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(record_id) DO UPDATE SET
           kind = excluded.kind,
           local_id = excluded.local_id,
           deleted = excluded.deleted,
           updated_at = excluded.updated_at,
           device_id = excluded.device_id,
           fields_json = excluded.fields_json,
           dirty = excluded.dirty,
           last_seq = excluded.last_seq,
           pending_client_op_id = excluded.pending_client_op_id,
           pending_nonce = excluded.pending_nonce,
           pending_ciphertext = excluded.pending_ciphertext,
           pending_updated_at = excluded.pending_updated_at`,
        bindRecord(record)
      );
    },
    async nextLocalId(kind) {
      const row = await db.get<{ next_id: number }>(
        'SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM journal_records WHERE kind = ?',
        [kind]
      );
      return row?.next_id ?? 1;
    },
    async countDirty() {
      const row = await db.get<{ n: number | bigint }>(
        'SELECT COUNT(*) AS n FROM journal_records WHERE dirty = 1'
      );
      return Number(row?.n ?? 0);
    },
    async markAllDirty() {
      await db.run(
        `UPDATE journal_records
         SET dirty = 1,
             pending_client_op_id = NULL,
             pending_nonce = NULL,
             pending_ciphertext = NULL,
             pending_updated_at = NULL
         WHERE kind IN ('todo', 'note', 'post')`
      );
    },
    async wipeRecords() {
      await db.run('DELETE FROM journal_records');
    },
  };
}

export function createMemorySyncStore(): SyncStore {
  const meta = new Map<string, string>();
  const records = new Map<string, JournalRecord>();
  const copy = (record: JournalRecord): JournalRecord => ({
    ...record,
    fields: JSON.parse(JSON.stringify(record.fields)) as { [key: string]: JsonValue },
  });
  return {
    async ensureSchema() {},
    async getMeta(key) {
      return meta.get(key) ?? null;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
    async getRecord(recordId) {
      const record = records.get(recordId);
      return record ? copy(record) : null;
    },
    async findByPendingOp(clientOpId) {
      for (const record of records.values()) {
        if (record.pendingClientOpId === clientOpId) return copy(record);
      }
      return null;
    },
    async listRecords() {
      return [...records.values()].map(copy);
    },
    async listDirty() {
      return [...records.values()]
        .filter((record) => record.dirty)
        .sort(
          (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.recordId.localeCompare(b.recordId)
        )
        .map(copy);
    },
    async saveRecord(record) {
      records.set(record.recordId, copy(record));
    },
    async nextLocalId(kind) {
      let max = 0;
      for (const record of records.values()) {
        if (record.kind === kind && record.localId != null && record.localId > max)
          max = record.localId;
      }
      return max + 1;
    },
    async countDirty() {
      let n = 0;
      for (const record of records.values()) if (record.dirty) n += 1;
      return n;
    },
    async markAllDirty() {
      for (const record of records.values()) {
        if (record.kind !== 'todo' && record.kind !== 'note' && record.kind !== 'post') continue;
        record.dirty = true;
        record.pendingClientOpId = null;
        record.pendingNonce = null;
        record.pendingCiphertext = null;
        record.pendingUpdatedAt = null;
      }
    },
    async wipeRecords() {
      records.clear();
    },
  };
}
