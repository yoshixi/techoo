import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import pino from 'pino'
import type { AppBindings } from '../types'
import { getVaultRoute, putVaultRoute, resetVaultRoute } from '../routes/vault'
import { getSyncHeadRoute, pullSyncOpsRoute, pushSyncOpsRoute } from '../routes/sync'
import { getVaultHandler, putVaultHandler, resetVaultHandler } from './vault'
import { getSyncHeadHandler, pullSyncOpsHandler, pushSyncOpsHandler } from './sync'
import { GENESIS_HASH, isEncryptedSyncPath } from '../../../core/sync.core'
import { chainHash, deleteUserSyncData, type SyncDatabase } from '../../../core/sync.db'
import { createMemorySyncDatabase } from '../../../db/tests/memorySyncDatabase'

const user = { id: 7, email: 'ada@example.com', name: 'Ada' }
const otherUser = { id: 8, email: 'bea@example.com', name: 'Bea' }

const vaultBody = {
  salt: 'c2FsdA',
  kdf: 'scrypt' as const,
  kdfParams: { N: 16384, r: 8, p: 1, keyLen: 32 },
  wrappedKey: 'd3JhcHBlZA',
  wrappedKeyNonce: 'bm9uY2U',
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

function op(n: number, ciphertext = `cipher-${n}`) {
  return {
    clientOpId: uuid(n),
    recordId: uuid(1000 + n),
    deviceId: uuid(42),
    nonce: `nonce-${n}`,
    ciphertext,
  }
}

function createTestApp(getUser: () => { id: number; email: string; name: string }, getDb: () => SyncDatabase | undefined) {
  const app = new OpenAPIHono<AppBindings>()
  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'test-request-id')
    c.set('user', getUser())
    const db = getDb()
    if (db) c.set('syncDb', db)
    await next()
  })
  app.openapi(putVaultRoute, putVaultHandler)
  app.openapi(getVaultRoute, getVaultHandler)
  app.openapi(resetVaultRoute, resetVaultHandler)
  app.openapi(getSyncHeadRoute, getSyncHeadHandler)
  app.openapi(pushSyncOpsRoute, pushSyncOpsHandler)
  app.openapi(pullSyncOpsRoute, pullSyncOpsHandler)
  return app
}

describe('encrypted sync paths', () => {
  it('matches the vault and sync API only', () => {
    expect(isEncryptedSyncPath('/api/v1/vault')).toBe(true)
    expect(isEncryptedSyncPath('/api/v1/vault/reset')).toBe(true)
    expect(isEncryptedSyncPath('/api/v1/sync')).toBe(true)
    expect(isEncryptedSyncPath('/api/v1/sync/ops')).toBe(true)
    expect(isEncryptedSyncPath('/api/v1/todos')).toBe(false)
    expect(isEncryptedSyncPath('/api/v1/notes')).toBe(false)
  })
})

describe('Encrypted sync service', () => {
  let syncDb: SyncDatabase
  let close: () => void
  let currentUser = user

  const app = () => createTestApp(() => currentUser, () => syncDb)
  const bareApp = () => createTestApp(() => currentUser, () => undefined)

  beforeEach(async () => {
    const memory = await createMemorySyncDatabase()
    syncDb = memory.db
    close = memory.close
    currentUser = user
  })

  afterEach(() => {
    close()
  })

  async function createVault() {
    const response = await app().request('/v1/vault', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(vaultBody),
    })
    expect(response.status).toBe(201)
    return response.json() as Promise<{ vaultId: string; headSeq: number; headHash: string }>
  }

  it('returns 503 when the D1 binding is absent', async () => {
    const response = await bareApp().request('/v1/vault')
    expect(response.status).toBe(503)
    const body = await response.json() as { code: string }
    expect(body.code).toBe('sync_unavailable')
  })

  it('creates one active vault and refuses a second', async () => {
    const created = await createVault()
    expect(created.headSeq).toBe(0)
    expect(created.headHash).toBe(GENESIS_HASH)

    const fetched = await app().request('/v1/vault')
    expect(fetched.status).toBe(200)
    const vault = await fetched.json() as { vaultId: string; wrappedKey: string; kdf: string }
    expect(vault.vaultId).toBe(created.vaultId)
    expect(vault.wrappedKey).toBe(vaultBody.wrappedKey)
    expect(vault.kdf).toBe('scrypt')

    const again = await app().request('/v1/vault', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(vaultBody),
    })
    expect(again.status).toBe(409)
    expect((await again.json() as { code: string }).code).toBe('vault_exists')
  })

  it('appends ciphertext, chains hashes, and replays the same clientOpId', async () => {
    const { vaultId } = await createVault()
    const first = op(1, 'note-v1')
    const second = op(2, 'note-v2')

    const pushed = await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [first, second] }),
    })
    expect(pushed.status).toBe(200)
    const body = await pushed.json() as { ops: Array<{ clientOpId: string; seq: number; prevHash: string }> }
    expect(body.ops.map((row) => row.seq)).toEqual([1, 2])
    expect(body.ops[0]?.prevHash).toBe(GENESIS_HASH)
    expect(body.ops[1]?.prevHash).toBe(await chainHash(GENESIS_HASH, 1, first.recordId, first.ciphertext))

    const replay = await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [first] }),
    })
    expect(replay.status).toBe(200)
    const replayed = await replay.json() as { ops: Array<{ seq: number }> }
    expect(replayed.ops[0]?.seq).toBe(1)

    const head = await app().request('/v1/sync')
    expect(head.status).toBe(200)
    expect(await head.json()).toMatchObject({ vaultId, headSeq: 2 })

    const pulled = await app().request(`/v1/sync/ops?vaultId=${vaultId}&after=1&limit=10`)
    expect(pulled.status).toBe(200)
    const page = await pulled.json() as { headSeq: number; ops: Array<{ seq: number; ciphertext: string }> }
    expect(page.headSeq).toBe(2)
    expect(page.ops).toEqual([
      expect.objectContaining({ seq: 2, ciphertext: 'note-v2', clientOpId: second.clientOpId }),
    ])
  })

  it('rejects a stale vault id and drops ciphertext when the vault is reset', async () => {
    const { vaultId } = await createVault()
    const pushed = await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [op(3, 'secret-note')] }),
    })
    expect(pushed.status).toBe(200)

    const reset = await app().request('/v1/vault/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...vaultBody, wrappedKey: 'bmV3LWtleQ' }),
    })
    expect(reset.status).toBe(201)
    const next = await reset.json() as { vaultId: string; headSeq: number; wrappedKey: string }
    expect(next.vaultId).not.toBe(vaultId)
    expect(next.headSeq).toBe(0)
    expect(next.wrappedKey).toBe('bmV3LWtleQ')

    const stale = await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [op(4)] }),
    })
    expect(stale.status).toBe(409)
    expect((await stale.json() as { code: string }).code).toBe('vault_reset')

    const pulled = await app().request(`/v1/sync/ops?vaultId=${next.vaultId}`)
    expect(pulled.status).toBe(200)
    expect(await pulled.json()).toMatchObject({ ops: [], headSeq: 0 })
  })

  it('keeps each account vault private', async () => {
    const { vaultId } = await createVault()
    await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [op(5, 'ada-only')] }),
    })

    currentUser = otherUser
    const missing = await app().request('/v1/vault')
    expect(missing.status).toBe(404)

    const stolen = await app().request(`/v1/sync/ops?vaultId=${vaultId}`)
    expect(stolen.status).toBe(404)

    await deleteUserSyncData(syncDb, user.id)
    currentUser = user
    const gone = await app().request('/v1/vault')
    expect(gone.status).toBe(404)
  })

  it('rejects a batch that repeats clientOpId', async () => {
    const { vaultId } = await createVault()
    const duplicate = op(6)
    const response = await app().request('/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId, ops: [duplicate, duplicate] }),
    })
    expect(response.status).toBe(400)
    expect((await response.json() as { code: string }).code).toBe('duplicate_client_op')
  })
})
