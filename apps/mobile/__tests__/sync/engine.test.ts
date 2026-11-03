import {
  chainHash,
  createMemorySyncStore,
  createNobleCrypto,
  GENESIS_HASH,
  JournalService,
  SyncEngine,
  SyncError,
  type SyncOpWire,
  type SyncTransport,
  type VaultMaterial,
} from '@/sync';
import { openNodeSqliteDatabase } from '@/sync/node';
import { createSqliteSyncStore } from '@/sync/store';

const crypto = createNobleCrypto();

function createServer() {
  let active: VaultMaterial | null = null;
  let ops: SyncOpWire[] = [];
  let vaultCounter = 0;

  const transport: SyncTransport = {
    async putVault(body) {
      if (active) throw new SyncError('vault_exists', 'exists');
      vaultCounter += 1;
      active = {
        ...body,
        vaultId: `00000000-0000-4000-8000-00000000000${vaultCounter}`,
        headSeq: 0,
        headHash: GENESIS_HASH,
      };
      ops = [];
      return active;
    },
    async getVault() {
      return active;
    },
    async resetVault(body) {
      if (!active) throw new SyncError('vault_not_found', 'missing');
      vaultCounter += 1;
      active = {
        ...body,
        vaultId: `00000000-0000-4000-8000-00000000000${vaultCounter}`,
        headSeq: 0,
        headHash: GENESIS_HASH,
      };
      ops = [];
      return active;
    },
    async getHead() {
      if (!active) return null;
      return { vaultId: active.vaultId, headSeq: active.headSeq, headHash: active.headHash };
    },
    async pushOps(body) {
      if (!active || body.vaultId !== active.vaultId) throw new SyncError('vault_reset', 'reset');
      const acks = [];
      let seq = active.headSeq;
      let prev = active.headHash;
      for (const op of body.ops) {
        const existing = ops.find((item) => item.clientOpId === op.clientOpId);
        if (existing) {
          acks.push({ clientOpId: op.clientOpId, seq: existing.seq, prevHash: existing.prevHash });
          continue;
        }
        seq += 1;
        const storedPrev = prev;
        prev = await chainHash(crypto, storedPrev, seq, op.recordId, op.ciphertext);
        const stored = { ...op, seq, prevHash: storedPrev };
        ops.push(stored);
        acks.push({ clientOpId: op.clientOpId, seq, prevHash: storedPrev });
      }
      active = { ...active, headSeq: seq, headHash: prev };
      return { ops: acks };
    },
    async pullOps(query) {
      if (!active || query.vaultId !== active.vaultId) throw new SyncError('vault_reset', 'reset');
      return {
        ops: ops.filter((op) => op.seq > query.after).slice(0, query.limit),
        headSeq: active.headSeq,
      };
    },
  };

  return {
    transport,
    ops: () => ops,
    reversePull(): SyncTransport {
      return {
        ...transport,
        async pullOps(query) {
          const page = await transport.pullOps(query);
          return { ...page, ops: [...page.ops].reverse() };
        },
      };
    },
  };
}

function pair(transport: SyncTransport, now: () => Date) {
  const store = createMemorySyncStore();
  const engine = new SyncEngine({ store, transport, crypto, now });
  const service = new JournalService(store, engine);
  return { store, engine, service };
}

describe('sync engine', () => {
  it('pushes, pulls out of order, merges last-writer-wins, and replays cleanly', async () => {
    const server = createServer();
    let nowA = Date.parse('2026-11-03T03:00:00.000Z');
    let nowB = Date.parse('2026-11-03T04:00:00.000Z');
    const deviceA = pair(server.transport, () => new Date(nowA));
    const deviceB = pair(server.reversePull(), () => new Date(nowB));

    await deviceA.engine.createVault('correct horse battery staple');
    const created = await deviceA.service.createTodo({ title: 'from A' });
    await deviceA.service.sync();

    await deviceB.engine.unlock('correct horse battery staple');
    const pulled = await deviceB.service.queryTodos();
    expect(pulled.map((todo) => todo.title)).toEqual(['from A']);

    nowA += 60_000;
    await deviceA.service.updateTodo(created.id, { title: 'A again' });
    nowB += 120_000;
    const onB = await deviceB.service.queryTodos();
    await deviceB.service.updateTodo(onB[0]!.id, { title: 'B wins' });
    await deviceA.service.sync();
    await deviceB.service.sync();
    await deviceA.service.sync();

    expect((await deviceA.service.queryTodos()).map((todo) => todo.title)).toEqual(['B wins']);
    expect((await deviceB.service.queryTodos()).map((todo) => todo.title)).toEqual(['B wins']);

    const before = await deviceA.service.queryTodos();
    await deviceA.service.sync();
    expect(await deviceA.service.queryTodos()).toEqual(before);
  });

  it('propagates a delete and refuses a broken chain', async () => {
    const server = createServer();
    const now = () => new Date('2026-11-03T03:00:00.000Z');
    const deviceA = pair(server.transport, now);
    const deviceB = pair(server.transport, now);
    await deviceA.engine.createVault('correct horse battery staple');
    const todo = await deviceA.service.createTodo({ title: 'gone' });
    await deviceA.service.sync();
    await deviceB.engine.unlock('correct horse battery staple');
    await deviceA.service.deleteTodo(todo.id);
    await deviceA.service.sync();
    await deviceB.service.sync();
    expect(await deviceB.service.queryTodos()).toEqual([]);

    const evil: SyncTransport = {
      ...server.transport,
      async pullOps(query) {
        const page = await server.transport.pullOps(query);
        return {
          ...page,
          ops: page.ops.map((op) => ({ ...op, ciphertext: `${op.ciphertext}tampered` })),
        };
      },
    };
    const deviceC = pair(evil, now);
    await expect(deviceC.engine.unlock('correct horse battery staple')).resolves.toBeTruthy();
    expect(deviceC.engine.lastResult?.status).toBe('error');
    expect(await deviceC.service.queryTodos()).toEqual([]);
  });

  it('reuses a client op id when the same snapshot is pushed twice', async () => {
    const server = createServer();
    const device = pair(server.transport, () => new Date('2026-11-03T03:00:00.000Z'));
    await device.engine.createVault('correct horse battery staple');
    await device.service.createTodo({ title: 'once' });
    const calls: string[][] = [];
    const original = server.transport.pushOps.bind(server.transport);
    server.transport.pushOps = async (body) => {
      calls.push(body.ops.map((op) => op.clientOpId));
      if (calls.length === 1) throw new SyncError('offline', 'dropped');
      return original(body);
    };
    const failed = await device.service.sync();
    expect(failed.status).toBe('offline');
    const again = await device.service.sync();
    expect(again.status).toBe('ok');
    expect(calls[1]).toEqual(calls[0]);
    expect(server.ops()).toHaveLength(1);
  });

  it('queues a vault created offline and uploads it on the next sync', async () => {
    const server = createServer();
    let online = false;
    const transport: SyncTransport = {
      getVault: () =>
        online ? server.transport.getVault() : Promise.reject(new SyncError('offline', 'offline')),
      putVault: (body) =>
        online
          ? server.transport.putVault(body)
          : Promise.reject(new SyncError('offline', 'offline')),
      resetVault: (body) =>
        online
          ? server.transport.resetVault(body)
          : Promise.reject(new SyncError('offline', 'offline')),
      getHead: () =>
        online ? server.transport.getHead() : Promise.reject(new SyncError('offline', 'offline')),
      pushOps: (body) =>
        online
          ? server.transport.pushOps(body)
          : Promise.reject(new SyncError('offline', 'offline')),
      pullOps: (query) =>
        online
          ? server.transport.pullOps(query)
          : Promise.reject(new SyncError('offline', 'offline')),
    };
    const device = pair(transport, () => new Date('2026-11-03T03:00:00.000Z'));
    const created = await device.engine.createVault('correct horse battery staple');
    expect(created.vaultId).toBe('');
    await device.service.createTodo({ title: 'offline' });
    online = true;
    const synced = await device.service.sync();
    expect(synced.status).toBe('ok');
    expect((await device.service.queryTodos()).map((todo) => todo.title)).toEqual(['offline']);
    expect(server.ops()).toHaveLength(1);
  });
});

describe('sqlite store', () => {
  it('round-trips a record through node:sqlite', async () => {
    const db = await openNodeSqliteDatabase();
    const store = createSqliteSyncStore(db);
    await store.ensureSchema();
    await store.setMeta('device_id', '22222222-2222-4222-8222-222222222222');
    await store.saveRecord({
      recordId: '11111111-1111-4111-8111-111111111111',
      kind: 'note',
      localId: 1,
      deleted: false,
      updatedAt: '2026-11-03T03:00:00.000Z',
      deviceId: '22222222-2222-4222-8222-222222222222',
      fields: { title: 'Hi', body: null, pinned: 0, createdAt: '2026-11-03T03:00:00.000Z' },
      dirty: true,
      lastSeq: null,
      pendingClientOpId: null,
      pendingNonce: null,
      pendingCiphertext: null,
      pendingUpdatedAt: null,
    });
    expect(await store.getMeta('device_id')).toBe('22222222-2222-4222-8222-222222222222');
    expect((await store.listDirty())[0]?.fields).toMatchObject({ title: 'Hi' });
    expect(await store.nextLocalId('note')).toBe(2);
  });
});
