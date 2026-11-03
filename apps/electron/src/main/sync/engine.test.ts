import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { chainHash } from './crypto'
import {
  GENESIS_HASH,
  MemoryJournalStore,
  SqliteJournalStore,
  SyncChainError,
  SyncDecryptError,
  SyncEngine,
  SyncRequestError,
  SyncVaultExistsError,
  SyncVaultResetError,
  fromBase64,
  toBase64
} from './index'
import type { SyncTransport, VaultDocument, WireOp, WireOpInput } from './transport'

class FakeServer {
  vault: VaultDocument | null = null
  ops: WireOp[] = []
  offline = false
  maxPage: number | null = null
  private serial = 1

  transport(): SyncTransport {
    const failIfOffline = (): void => {
      if (this.offline) throw new SyncRequestError(0, 'offline', 'offline')
    }
    return {
      getVault: async () => {
        failIfOffline()
        return this.vault ? structuredClone(this.vault) : null
      },
      putVault: async (body) => {
        failIfOffline()
        if (this.vault)
          throw new SyncRequestError(409, 'vault_exists', 'An active vault already exists')
        this.vault = {
          ...structuredClone(body),
          vaultId: this.nextVaultId(),
          headSeq: 0,
          headHash: GENESIS_HASH
        }
        this.ops = []
        return structuredClone(this.vault)
      },
      resetVault: async (body) => {
        failIfOffline()
        if (!this.vault) throw new SyncRequestError(404, 'vault_not_found', 'No active vault')
        this.vault = {
          ...structuredClone(body),
          vaultId: this.nextVaultId(),
          headSeq: 0,
          headHash: GENESIS_HASH
        }
        this.ops = []
        return structuredClone(this.vault)
      },
      getHead: async () => {
        failIfOffline()
        if (!this.vault) throw new SyncRequestError(404, 'vault_not_found', 'No active vault')
        return {
          vaultId: this.vault.vaultId,
          headSeq: this.vault.headSeq,
          headHash: this.vault.headHash
        }
      },
      pushOps: async (body) => {
        failIfOffline()
        if (!this.vault) throw new SyncRequestError(404, 'vault_not_found', 'No active vault')
        if (body.vaultId !== this.vault.vaultId) {
          throw new SyncRequestError(409, 'vault_reset', 'The active vault has changed')
        }
        const known = new Map(this.ops.map((op) => [op.clientOpId, op]))
        let seq = this.vault.headSeq
        let prevHash = this.vault.headHash
        for (const op of body.ops) {
          if (known.has(op.clientOpId)) continue
          seq += 1
          const storedPrev = prevHash
          prevHash = chainHash(storedPrev, seq, op.recordId, op.ciphertext)
          const stored: WireOp = { ...op, seq, prevHash: storedPrev }
          this.ops.push(stored)
          known.set(op.clientOpId, stored)
        }
        this.vault.headSeq = seq
        this.vault.headHash = prevHash
        return {
          ops: body.ops.map((op: WireOpInput) => {
            const stored = known.get(op.clientOpId)
            if (!stored) throw new Error('missing op')
            return { clientOpId: stored.clientOpId, seq: stored.seq, prevHash: stored.prevHash }
          })
        }
      },
      pullOps: async (query) => {
        failIfOffline()
        if (!this.vault) throw new SyncRequestError(404, 'vault_not_found', 'No active vault')
        if (query.vaultId !== this.vault.vaultId) {
          throw new SyncRequestError(409, 'vault_reset', 'The active vault has changed')
        }
        let ops = this.ops.filter((op) => op.seq > query.after)
        if (this.maxPage !== null) ops = ops.slice(0, this.maxPage)
        return { ops: ops.map((op) => ({ ...op })), headSeq: this.vault.headSeq }
      }
    }
  }

  private nextVaultId(): string {
    const suffix = this.serial.toString(16).padStart(12, '0')
    this.serial += 1
    return `99999999-9999-4999-8999-${suffix}`
  }
}

function clock(start: string): () => string {
  let ms = Date.parse(start)
  return () => {
    ms += 1000
    return new Date(ms).toISOString()
  }
}

describe('sync engine', () => {
  it('pushes, pulls a paged log, merges, replays, and stays offline', async () => {
    const server = new FakeServer()
    server.maxPage = 1
    const aliceStore = new MemoryJournalStore()
    const alice = new SyncEngine(aliceStore, server.transport(), {
      now: clock('2026-11-03T03:00:00.000Z')
    })
    const setup = await alice.setup('correct horse battery staple')
    expect(setup.offline).toBe(false)

    alice.upsertRecord({ kind: 'note', fields: { title: 'Milk', body: 'Buy milk', pinned: false } })
    alice.upsertRecord({ kind: 'todo', fields: { title: 'Walk', done: false, isAllDay: false } })
    const pushed = await alice.sync()
    expect(pushed.offline).toBe(false)
    expect(server.ops).toHaveLength(2)
    expect(alice.listRecords('note').map((record) => record.fields.title)).toEqual(['Milk'])
    expect(alice.status().pendingCount).toBe(0)
    expect(alice.status().dirtyCount).toBe(0)

    const bobStore = new MemoryJournalStore()
    const bob = new SyncEngine(bobStore, server.transport(), {
      now: clock('2026-11-03T04:00:00.000Z')
    })
    expect(await bob.discover()).toBe('ready')
    await bob.unlock('correct horse battery staple')
    await bob.sync()
    expect(bob.listRecords('todo').map((record) => record.fields.title)).toEqual(['Walk'])

    const edited = bob.upsertRecord({
      recordId: bob.listRecords('note')[0]?.recordId,
      kind: 'note',
      fields: { title: 'Oat milk', body: 'Buy oat milk', pinned: true }
    })
    await bob.sync()
    await alice.sync()
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Oat milk')

    bob.deleteRecord(edited.recordId)
    await bob.sync()
    await alice.sync()
    expect(alice.listRecords('note')).toHaveLength(0)
    expect(alice.listRecords('note', true)[0]?.deleted).toBe(true)

    const cursor = alice.status().cursor
    bobStore.setMeta('cursor_seq', '0')
    bobStore.setMeta('head_hash', GENESIS_HASH)
    await bob.sync()
    expect(bob.listRecords('note', true)).toHaveLength(1)
    expect(bob.listRecords('note')).toHaveLength(0)
    expect(alice.status().cursor).toBe(cursor)

    const before = alice.listRecords('todo')[0]?.fields.title
    const first = server.ops[0]
    expect(first).toBeDefined()
    if (!first) return
    const broken = fromBase64(first.ciphertext)
    broken[broken.length - 1] = broken[broken.length - 1] ^ 0x01
    first.ciphertext = toBase64(broken)
    aliceStore.setMeta('cursor_seq', '0')
    aliceStore.setMeta('head_hash', GENESIS_HASH)
    await expect(alice.sync()).rejects.toBeInstanceOf(SyncChainError)
    expect(alice.listRecords('todo')[0]?.fields.title).toBe(before)
  })

  it('rejects a ciphertext whose chain was rewritten around the tamper', async () => {
    const server = new FakeServer()
    const store = new MemoryJournalStore()
    const alice = new SyncEngine(store, server.transport(), {
      now: clock('2026-11-03T05:00:00.000Z')
    })
    await alice.setup('correct horse battery staple')
    alice.upsertRecord({ kind: 'note', fields: { title: 'Kept' } })
    await alice.sync()
    const op = server.ops[0]
    expect(op).toBeDefined()
    if (!op || !server.vault) return
    const bytes = fromBase64(op.ciphertext)
    bytes[0] = bytes[0] ^ 0x01
    op.ciphertext = toBase64(bytes)
    let prev = GENESIS_HASH
    for (const item of server.ops) {
      item.prevHash = prev
      prev = chainHash(prev, item.seq, item.recordId, item.ciphertext)
    }
    server.vault.headHash = prev
    store.setMeta('cursor_seq', '0')
    store.setMeta('head_hash', GENESIS_HASH)
    await expect(alice.sync()).rejects.toBeInstanceOf(SyncDecryptError)
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Kept')
  })

  it('keeps local edits while offline and registers the vault later', async () => {
    const server = new FakeServer()
    server.offline = true
    const alice = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T06:00:00.000Z')
    })
    const report = await alice.setup('correct horse battery staple')
    expect(report.offline).toBe(true)
    alice.upsertRecord({ kind: 'post', fields: { body: 'hello from the train' } })
    expect(alice.listRecords('post')).toHaveLength(1)
    server.offline = false
    const synced = await alice.sync()
    expect(synced.offline).toBe(false)
    expect(server.ops).toHaveLength(1)
    expect(server.vault?.headSeq).toBe(1)
  })

  it('surfaces vault_exists and vault_reset without dropping the local journal', async () => {
    const server = new FakeServer()
    const alice = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T07:00:00.000Z')
    })
    await alice.setup('correct horse battery staple')
    alice.upsertRecord({ kind: 'note', fields: { title: 'Local' } })
    await alice.sync()

    const colliding = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T08:00:00.000Z')
    })
    await expect(colliding.setup('correct horse battery staple')).rejects.toBeInstanceOf(
      SyncVaultExistsError
    )

    const other = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T08:10:00.000Z')
    })
    expect(await other.discover()).toBe('ready')
    await other.unlock('correct horse battery staple')
    await other.sync()
    expect(other.listRecords('note')[0]?.fields.title).toBe('Local')
    await other.reset('a different passphrase')
    expect(other.listRecords('note')[0]?.fields.title).toBe('Local')
    await expect(alice.sync()).rejects.toBeInstanceOf(SyncVaultResetError)
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Local')

    await expect(alice.discardAndJoin('wrong passphrase')).rejects.toThrow()
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Local')
    await alice.discardAndJoin('a different passphrase')
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Local')
    expect(alice.status().vaultId).toBe(other.status().vaultId)
  })

  it('uploads this device after the server already had a vault', async () => {
    const server = new FakeServer()
    const alice = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T08:20:00.000Z')
    })
    await alice.setup('correct horse battery staple')
    alice.upsertRecord({ kind: 'note', fields: { title: 'Server copy' } })
    await alice.sync()

    const bob = new SyncEngine(new MemoryJournalStore(), server.transport(), {
      now: clock('2026-11-03T08:30:00.000Z')
    })
    await expect(bob.setup('correct horse battery staple')).rejects.toBeInstanceOf(
      SyncVaultExistsError
    )
    bob.upsertRecord({ kind: 'note', fields: { title: 'This device' } })
    const report = await bob.replaceServerWithLocal()
    expect(report.offline).toBe(false)
    expect(bob.listRecords('note').map((record) => record.fields.title)).toEqual(['This device'])
    expect(server.ops).toHaveLength(1)
    await expect(alice.sync()).rejects.toBeInstanceOf(SyncVaultResetError)
    expect(alice.listRecords('note')[0]?.fields.title).toBe('Server copy')
  })

  it('reopens the plaintext sqlite journal and unlocks from the cached wrap', async () => {
    const server = new FakeServer()
    const dir = mkdtempSync(join(tmpdir(), 'techoo-sync-'))
    const path = join(dir, 'journal.sqlite')
    try {
      const store = SqliteJournalStore.open(path)
      const alice = new SyncEngine(store, server.transport(), {
        now: clock('2026-11-03T09:00:00.000Z')
      })
      await alice.setup('correct horse battery staple')
      alice.upsertRecord({ kind: 'note', fields: { title: 'On disk' } })
      await alice.sync()
      alice.lock()
      store.close()

      server.offline = true
      const reopened = SqliteJournalStore.open(path)
      const again = new SyncEngine(reopened, server.transport(), {
        now: clock('2026-11-03T10:00:00.000Z')
      })
      expect(again.listRecords('note')[0]?.fields.title).toBe('On disk')
      await again.unlock('correct horse battery staple')
      expect(again.isUnlocked()).toBe(true)
      again.lock()
      reopened.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
