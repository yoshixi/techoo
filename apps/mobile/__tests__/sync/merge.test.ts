import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeRecord, type MergeVersion } from '@/sync';

type Row = {
  recordId: string;
  kind: 'note' | 'todo' | 'post';
  deleted: boolean;
  updatedAt: string;
  originSeq: number;
  originDeviceId: string;
  dirty: boolean;
  fields: MergeVersion['fields'];
};

type MergeCase = {
  name: string;
  orderIndependent: boolean;
  start: Row | null;
  incoming: Row[];
  expect: {
    title: string | null;
    deleted: boolean;
    updatedAt: string;
    originSeq: number;
    originDeviceId: string;
    dirty: boolean;
  };
};

const cases = (
  JSON.parse(readFileSync(join(__dirname, '../fixtures/sync-vectors.json'), 'utf8')) as {
    mergeCases: MergeCase[];
  }
).mergeCases;

function toVersion(row: Row): MergeVersion {
  return {
    recordId: row.recordId,
    kind: row.kind,
    deleted: row.deleted,
    updatedAt: row.updatedAt,
    deviceId: row.originDeviceId,
    seq: row.originSeq,
    fields: row.fields,
  };
}

function apply(start: Row | null, incoming: Row[]): { version: MergeVersion; dirty: boolean } {
  let current = start ? toVersion(start) : null;
  let dirty = start?.dirty ?? false;
  for (const row of incoming) {
    const outcome = mergeRecord(current, toVersion(row));
    current = outcome.record;
    if (outcome.applied) dirty = false;
  }
  if (!current) throw new Error('merge produced no row');
  return { version: current, dirty };
}

function expectRow(
  result: { version: MergeVersion; dirty: boolean },
  expected: MergeCase['expect']
) {
  const title =
    typeof result.version.fields.title === 'string' ? result.version.fields.title : null;
  expect(title).toBe(expected.title);
  expect(result.version.deleted).toBe(expected.deleted);
  expect(result.version.updatedAt).toBe(expected.updatedAt);
  expect(result.version.seq).toBe(expected.originSeq);
  expect(result.version.deviceId).toBe(expected.originDeviceId);
  expect(result.dirty).toBe(expected.dirty);
}

describe('merge vectors', () => {
  it.each(cases.map((item) => [item.name, item] as const))('%s', (_name, item) => {
    expectRow(apply(item.start, item.incoming), item.expect);
    if (item.orderIndependent) {
      expectRow(apply(item.start, [...item.incoming].reverse()), item.expect);
    }
  });
});
