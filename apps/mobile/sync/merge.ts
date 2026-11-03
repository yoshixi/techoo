import type { JsonValue, RecordKind } from './types';

/**
 * One version of a record, either already stored or arriving from the log.
 * `seq` is null for a local edit that has not been assigned a log position.
 * A null seq sorts below every real seq, so a logged copy of the same write wins.
 */
export type MergeVersion = {
  recordId: string;
  kind: RecordKind;
  deleted: boolean;
  updatedAt: string;
  deviceId: string;
  seq: number | null;
  fields: { [key: string]: JsonValue };
};

export type MergeOutcome = {
  record: MergeVersion;
  applied: boolean;
};

/**
 * Last-writer-wins per recordId. Comparison is a total order, so applying the
 * same set in any order (or more than once) ends at the same record.
 *
 * 1. Greater `updatedAt` wins. Timestamps are `YYYY-MM-DDTHH:mm:ss.sssZ`, so
 *    byte order matches time order.
 * 2. If those are equal, the lexicographically greater lowercase `deviceId` wins.
 * 3. If those are equal, the greater `seq` wins. A local edit with no seq yet counts as 0.
 * 4. A delete is a normal version (`deleted: true`). A newer write resurrects it.
 * 5. The winner replaces `fields` as a whole. There is no per-field merge.
 * 6. An equal triple does not apply again (idempotent replay).
 */
export function compareVersions(left: MergeVersion, right: MergeVersion): number {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? -1 : 1;
  if (left.deviceId !== right.deviceId) return left.deviceId < right.deviceId ? -1 : 1;
  const leftSeq = left.seq ?? 0;
  const rightSeq = right.seq ?? 0;
  return leftSeq - rightSeq;
}

export function mergeRecord(local: MergeVersion | null, incoming: MergeVersion): MergeOutcome {
  if (!local || compareVersions(incoming, local) > 0) {
    return { record: incoming, applied: true };
  }
  return { record: local, applied: false };
}

/** Fold a set of versions. Order does not change the winner. */
export function mergeAll(versions: MergeVersion[]): MergeVersion | null {
  let current: MergeVersion | null = null;
  for (const version of versions) {
    current = mergeRecord(current, version).record;
  }
  return current;
}
