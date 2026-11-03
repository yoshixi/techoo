import type { JsonValue, PlainRecord, RecordKind } from './types';
import { SyncError } from './types';

const KINDS = new Set<RecordKind>(['todo', 'note', 'post']);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const child = source[key];
      if (child === undefined) continue;
      out[key] = sortValue(child);
    }
    return out;
  }
  return value;
}

function rejectNulls(value: unknown): void {
  if (value === null) throw new SyncError('payload', 'null is not used in a record');
  if (Array.isArray(value)) {
    value.forEach(rejectNulls);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(rejectNulls);
  }
}

export function assertTimestamp(value: string): void {
  if (!TIMESTAMP.test(value)) {
    throw new SyncError('payload', `timestamp must be UTC milliseconds, got ${value}`);
  }
}

function requireString(fields: Record<string, unknown>, key: string): void {
  if (typeof fields[key] !== 'string' || fields[key] === '') {
    throw new SyncError('payload', `${key} is required`);
  }
}

function requireTimestamp(fields: Record<string, unknown>, key: string): void {
  requireString(fields, key);
  assertTimestamp(fields[key] as string);
}

function requireBoolean(fields: Record<string, unknown>, key: string): void {
  if (typeof fields[key] !== 'boolean') throw new SyncError('payload', `${key} must be boolean`);
}

function validateFields(kind: RecordKind, fields: Record<string, unknown>, deleted: boolean): void {
  if (deleted) {
    if (Object.keys(fields).length !== 0)
      throw new SyncError('payload', 'tombstone fields must be empty');
    return;
  }
  if (kind === 'todo') {
    requireString(fields, 'title');
    requireTimestamp(fields, 'createdAt');
    requireBoolean(fields, 'done');
    requireBoolean(fields, 'isAllDay');
    for (const key of ['description']) {
      if (key in fields && (typeof fields[key] !== 'string' || fields[key] === '')) {
        throw new SyncError('payload', `${key} must be a non-empty string when present`);
      }
    }
    for (const key of ['startsAt', 'endsAt', 'doneAt']) {
      if (key in fields) {
        if (typeof fields[key] !== 'string')
          throw new SyncError('payload', `${key} must be a timestamp`);
        assertTimestamp(fields[key] as string);
      }
    }
  }
  if (kind === 'note') {
    requireString(fields, 'title');
    requireTimestamp(fields, 'createdAt');
    requireBoolean(fields, 'pinned');
    if ('body' in fields && (typeof fields.body !== 'string' || fields.body === '')) {
      throw new SyncError('payload', 'body must be a non-empty string when present');
    }
  }
  if (kind === 'post') {
    requireString(fields, 'body');
    requireTimestamp(fields, 'postedAt');
    if ('parentRecordId' in fields && typeof fields.parentRecordId !== 'string') {
      throw new SyncError('payload', 'parentRecordId must be a string');
    }
  }
}

export function parsePlainRecord(json: string): PlainRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyncError('payload', 'record plaintext is not JSON');
  }
  rejectNulls(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SyncError('payload', 'record plaintext must be an object');
  }
  const body = parsed as Record<string, unknown>;
  if (body.v !== 1) throw new SyncError('payload', 'unsupported record version');
  if (typeof body.kind !== 'string' || !KINDS.has(body.kind as RecordKind)) {
    throw new SyncError('payload', 'unknown record kind');
  }
  if (typeof body.recordId !== 'string') throw new SyncError('payload', 'recordId is required');
  if (typeof body.deleted !== 'boolean') throw new SyncError('payload', 'deleted must be boolean');
  if (typeof body.updatedAt !== 'string') throw new SyncError('payload', 'updatedAt is required');
  assertTimestamp(body.updatedAt);
  if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) {
    throw new SyncError('payload', 'fields must be an object');
  }
  validateFields(body.kind as RecordKind, body.fields as Record<string, unknown>, body.deleted);
  return {
    v: 1,
    kind: body.kind as RecordKind,
    recordId: body.recordId.toLowerCase(),
    deleted: body.deleted,
    updatedAt: body.updatedAt,
    fields: body.fields as { [key: string]: JsonValue },
  };
}
