import type { JsonValue } from './payload'
import type { RecordKind } from './protocol'

/**
 * One version of a record, for last-writer-wins.
 *
 * Compare order:
 * 1. `updatedAt` (ISO-8601 UTC with milliseconds). The greater string wins.
 * 2. `deviceId` (lowercase UUID). The greater string wins.
 * 3. `seq` (server-assigned). The greater number wins. An edit that has not been
 *    assigned a seq yet uses 0, so a synced op with the same timestamp and device wins a replay.
 * A total tie keeps the version already stored (idempotent replay).
 */
export interface MergeVersion {
  updatedAt: string
  deviceId: string
  seq: number
}

/** Positive when `a` should replace `b`. Zero when they tie. */
export function compareVersions(a: MergeVersion, b: MergeVersion): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? 1 : -1
  if (a.deviceId !== b.deviceId) return a.deviceId > b.deviceId ? 1 : -1
  if (a.seq !== b.seq) return a.seq > b.seq ? 1 : -1
  return 0
}

export interface MergeRecord {
  recordId: string
  kind: RecordKind
  deleted: boolean
  updatedAt: string
  originSeq: number
  originDeviceId: string
  fields: { [key: string]: JsonValue }
  /** True when the stored fields include a local edit that has not been acknowledged. */
  dirty: boolean
}

/**
 * `localDeviceId` is this device's id. A dirty local row is compared as
 * `{ updatedAt, deviceId: localDeviceId, seq: 0 }`.
 * The incoming row is a decrypted op and must already have `dirty: false`.
 * Returns the row to store. A tie returns `local` unchanged.
 */
export function mergeRecord(
  local: MergeRecord | null,
  incoming: MergeRecord,
  localDeviceId: string
): MergeRecord {
  if (local && local.recordId !== incoming.recordId) {
    throw new Error('cannot merge different record ids')
  }
  if (!local) return { ...incoming, dirty: false }
  const winner = compareVersions(
    versionOf(incoming, localDeviceId),
    versionOf(local, localDeviceId)
  )
  if (winner > 0) return { ...incoming, dirty: false }
  return local
}

export function versionOf(record: MergeRecord, localDeviceId: string): MergeVersion {
  if (record.dirty) {
    return { updatedAt: record.updatedAt, deviceId: localDeviceId, seq: 0 }
  }
  return {
    updatedAt: record.updatedAt,
    deviceId: record.originDeviceId,
    seq: record.originSeq
  }
}

/** Fold ops in the given order. The result does not depend on that order. */
export function foldRecords(
  ops: readonly MergeRecord[],
  localDeviceId: string,
  start: MergeRecord | null = null
): MergeRecord | null {
  return ops.reduce<MergeRecord | null>(
    (local, incoming) => mergeRecord(local, incoming, localDeviceId),
    start
  )
}
