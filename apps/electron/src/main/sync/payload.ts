import { RECORD_KINDS, assertTimestamp, assertUuid, type RecordKind } from './protocol'

export type JsonValue = string | number | boolean | JsonValue[] | { [key: string]: JsonValue }

export interface SyncPayload {
  v: 1
  kind: RecordKind
  recordId: string
  deleted: boolean
  updatedAt: string
  fields: { [key: string]: JsonValue }
}

const TODO_REQUIRED = ['createdAt', 'done', 'isAllDay', 'title'] as const
const NOTE_REQUIRED = ['createdAt', 'pinned', 'title'] as const
const POST_REQUIRED = ['body', 'postedAt'] as const

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertJsonValue(value: unknown, label: string): JsonValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer`)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => assertJsonValue(entry, `${label}[${index}]`))
  }
  if (isPlainObject(value)) {
    const out: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(value)) {
      out[key] = assertJsonValue(value[key], `${label}.${key}`)
    }
    return out
  }
  throw new Error(`${label} is not valid JSON`)
}

/** Canonical JSON: objects keys sorted by UTF-16 code unit, no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortValue(entry))
  if (isPlainObject(value)) {
    const out: { [key: string]: unknown } = {}
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue
      out[key] = sortValue(value[key])
    }
    return out
  }
  return value
}

function requireString(fields: { [key: string]: JsonValue }, key: string): void {
  if (typeof fields[key] !== 'string') throw new Error(`${key} must be a string`)
}

function requireBoolean(fields: { [key: string]: JsonValue }, key: string): void {
  if (typeof fields[key] !== 'boolean') throw new Error(`${key} must be a boolean`)
}

function optionalString(
  fields: { [key: string]: JsonValue },
  key: string,
  timestamp: boolean
): void {
  const value = fields[key]
  if (value === undefined) return
  if (typeof value !== 'string') throw new Error(`${key} must be a string`)
  if (value === '') {
    delete fields[key]
    return
  }
  if (timestamp) assertTimestamp(value, key)
  if (key === 'parentRecordId') assertUuid(value, key)
}

/**
 * Check a record body and drop empty optional strings.
 * Unknown keys are kept so a peer can add a field without this client deleting it on the next edit.
 */
export function canonicalizeFields(
  kind: RecordKind,
  fields: { [key: string]: JsonValue },
  deleted: boolean
): { [key: string]: JsonValue } {
  const copy: { [key: string]: JsonValue } = {}
  for (const key of Object.keys(fields)) {
    copy[key] = assertJsonValue(fields[key], key)
  }
  if (deleted) {
    if (Object.keys(copy).length !== 0) {
      throw new Error('a tombstone must use empty fields')
    }
    return {}
  }
  if (kind === 'todo') {
    for (const key of TODO_REQUIRED) {
      if (copy[key] === undefined) throw new Error(`todo.${key} is required`)
    }
    requireString(copy, 'title')
    requireString(copy, 'createdAt')
    assertTimestamp(String(copy.createdAt), 'createdAt')
    requireBoolean(copy, 'done')
    requireBoolean(copy, 'isAllDay')
    optionalString(copy, 'description', false)
    optionalString(copy, 'startsAt', true)
    optionalString(copy, 'endsAt', true)
    optionalString(copy, 'doneAt', true)
  } else if (kind === 'note') {
    for (const key of NOTE_REQUIRED) {
      if (copy[key] === undefined) throw new Error(`note.${key} is required`)
    }
    requireString(copy, 'title')
    requireString(copy, 'createdAt')
    assertTimestamp(String(copy.createdAt), 'createdAt')
    requireBoolean(copy, 'pinned')
    optionalString(copy, 'body', false)
  } else {
    for (const key of POST_REQUIRED) {
      if (copy[key] === undefined) throw new Error(`post.${key} is required`)
    }
    requireString(copy, 'body')
    requireString(copy, 'postedAt')
    assertTimestamp(String(copy.postedAt), 'postedAt')
    optionalString(copy, 'parentRecordId', false)
  }
  return copy
}

export function encodePayload(payload: SyncPayload): string {
  if (payload.v !== 1) throw new Error('unsupported payload version')
  if (!RECORD_KINDS.includes(payload.kind)) throw new Error('unsupported record kind')
  assertUuid(payload.recordId, 'recordId')
  if (typeof payload.deleted !== 'boolean') throw new Error('deleted must be a boolean')
  assertTimestamp(payload.updatedAt, 'updatedAt')
  const fields = canonicalizeFields(payload.kind, payload.fields, payload.deleted)
  return canonicalJson({
    deleted: payload.deleted,
    fields,
    kind: payload.kind,
    recordId: payload.recordId,
    updatedAt: payload.updatedAt,
    v: 1
  })
}

export function decodePayload(plaintext: string, expectedRecordId: string): SyncPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(plaintext) as unknown
  } catch {
    throw new Error('payload is not JSON')
  }
  if (!isPlainObject(parsed)) throw new Error('payload must be an object')
  if (parsed.v !== 1) throw new Error('unsupported payload version')
  const kind = parsed.kind
  if (kind !== 'todo' && kind !== 'post' && kind !== 'note')
    throw new Error('unsupported record kind')
  if (typeof parsed.recordId !== 'string') throw new Error('recordId missing')
  assertUuid(parsed.recordId, 'recordId')
  if (parsed.recordId !== expectedRecordId) {
    throw new Error('payload recordId does not match the op')
  }
  if (typeof parsed.deleted !== 'boolean') throw new Error('deleted must be a boolean')
  if (typeof parsed.updatedAt !== 'string') throw new Error('updatedAt missing')
  assertTimestamp(parsed.updatedAt, 'updatedAt')
  if (!isPlainObject(parsed.fields)) throw new Error('fields must be an object')
  const rawFields: { [key: string]: JsonValue } = {}
  for (const key of Object.keys(parsed.fields)) {
    rawFields[key] = assertJsonValue(parsed.fields[key], `fields.${key}`)
  }
  const fields = canonicalizeFields(kind, rawFields, parsed.deleted)
  return {
    v: 1,
    kind,
    recordId: parsed.recordId,
    deleted: parsed.deleted,
    updatedAt: parsed.updatedAt,
    fields
  }
}
