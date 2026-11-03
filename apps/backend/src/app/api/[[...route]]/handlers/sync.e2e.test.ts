import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { SignJWT } from 'jose'
import pino from 'pino'
import type { AppBindings } from '../types'
import { getVaultRoute, putVaultRoute, resetVaultRoute } from '../routes/vault'
import { getSyncHeadRoute, pullSyncOpsRoute, pushSyncOpsRoute } from '../routes/sync'
import { getVaultHandler, putVaultHandler, resetVaultHandler } from './vault'
import { getSyncHeadHandler, pullSyncOpsHandler, pushSyncOpsHandler } from './sync'
import { registerJwtAuthMiddleware } from '../middleware/jwt-auth'
import { signJwt } from '../../../core/jwt'
import { GENESIS_HASH } from '../../../core/sync.core'
import { chainHash, type SyncDatabase } from '../../../core/sync.db'
import { createMemorySyncDatabase } from '../../../db/tests/memorySyncDatabase'

const jwtEnv = vi.hoisted(() => {
  const env = process.env as Record<string, string | undefined>
  const secret = 'e2e-sync-jwt-secret-at-least-32-chars'
  const issuer = 'http://localhost:8787'
  env.JWT_SECRET = secret
  env.BETTER_AUTH_URL = issuer
  return { secret, issuer }
})

vi.mock('../../../core/common.db', () => ({
  getTenantDbForUser: () => {
    throw new Error('encrypted sync e2e opened a Turso tenant database')
  },
}))

vi.mock('../../../core/oauth.service', () => ({
  createOAuthService: () => {
    throw new Error('encrypted sync e2e created an OAuth service')
  },
}))

const ada = { id: 7, email: 'ada@example.com', name: 'Ada' }
const bea = { id: 8, email: 'bea@example.com', name: 'Bea' }
const deviceA = '00000000-0000-4000-8000-00000000000a'
const deviceB = '00000000-0000-4000-8000-00000000000b'

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

function op(n: number, deviceId: string, ciphertext = `cipher-${n}`) {
  return {
    clientOpId: uuid(n),
    recordId: uuid(1000 + n),
    deviceId,
    nonce: `nonce-${n}`,
    ciphertext,
  }
}

function createApp(syncDb: SyncDatabase) {
  const app = new OpenAPIHono<AppBindings>().basePath('/api')
  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'e2e-request-id')
    c.set('syncDb', syncDb)
    await next()
  })
  registerJwtAuthMiddleware(app)
  app.openapi(putVaultRoute, putVaultHandler)
  app.openapi(getVaultRoute, getVaultHandler)
  app.openapi(resetVaultRoute, resetVaultHandler)
  app.openapi(getSyncHeadRoute, getSyncHeadHandler)
  app.openapi(pushSyncOpsRoute, pushSyncOpsHandler)
  app.openapi(pullSyncOpsRoute, pullSyncOpsHandler)
  return app
}

async function countRows(db: SyncDatabase, table: 'vaults' | 'sync_ops'): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number | bigint }>()
  return Number(row?.n ?? 0)
}

async function bearer(user: { id: number; email: string; name: string }, init: RequestInit = {}): Promise<RequestInit> {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${await signJwt(user)}`)
  if (init.body) headers.set('content-type', 'application/json')
  return { ...init, headers }
}

describe('encrypted sync end to end', () => {
  let syncDb: SyncDatabase
  let close: () => void
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    const memory = await createMemorySyncDatabase()
    syncDb = memory.db
    close = memory.close
    app = createApp(syncDb)
  })

  afterEach(() => {
    close()
  })

  async function createVault(user = ada) {
    const response = await app.request('/api/v1/vault', await bearer(user, {
      method: 'PUT',
      body: JSON.stringify(vaultBody),
    }))
    expect(response.status).toBe(201)
    return response.json() as Promise<{ vaultId: string; headSeq: number; headHash: string }>
  }

  it('rejects a missing or invalid bearer token before writing', async () => {
    const missing = await app.request('/api/v1/vault', { method: 'PUT', body: JSON.stringify(vaultBody) })
    expect(missing.status).toBe(401)

    const wrongSecret = await new SignJWT({ email: ada.email, name: ada.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(ada.id))
      .setIssuer(jwtEnv.issuer)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('wrong-secret-that-is-at-least-32-chars'))
    const invalid = await app.request('/api/v1/vault', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${wrongSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(vaultBody),
    })
    expect(invalid.status).toBe(401)
    expect(await countRows(syncDb, 'vaults')).toBe(0)
    expect(await countRows(syncDb, 'sync_ops')).toBe(0)
  })

  it('creates a vault whose head is the genesis hash', async () => {
    const created = await createVault()
    expect(created.headSeq).toBe(0)
    expect(created.headHash).toBe(GENESIS_HASH)

    const fetched = await app.request('/api/v1/vault', await bearer(ada))
    expect(fetched.status).toBe(200)
    const vault = await fetched.json() as { vaultId: string; wrappedKey: string; headSeq: number; headHash: string }
    expect(vault.vaultId).toBe(created.vaultId)
    expect(vault.wrappedKey).toBe(vaultBody.wrappedKey)
    expect(vault.headSeq).toBe(0)
    expect(vault.headHash).toBe(GENESIS_HASH)

    const head = await app.request('/api/v1/sync', await bearer(ada))
    expect(head.status).toBe(200)
    expect(await head.json()).toEqual({
      vaultId: created.vaultId,
      headSeq: 0,
      headHash: GENESIS_HASH,
    })
  })

  it('chains two ciphertext ops and returns them unchanged after a cursor', async () => {
    const { vaultId } = await createVault()
    const first = op(1, deviceA, 'note-v1')
    const second = op(2, deviceA, 'note-v2')
    const hash1 = await chainHash(GENESIS_HASH, 1, first.recordId, first.ciphertext)
    const hash2 = await chainHash(hash1, 2, second.recordId, second.ciphertext)

    const pushed = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [first, second] }),
    }))
    expect(pushed.status).toBe(200)
    const body = await pushed.json() as { ops: Array<{ seq: number; prevHash: string }> }
    expect(body.ops.map((row) => row.seq)).toEqual([1, 2])
    expect(body.ops[0]?.prevHash).toBe(GENESIS_HASH)
    expect(body.ops[1]?.prevHash).toBe(hash1)

    const head = await app.request('/api/v1/sync', await bearer(ada))
    expect(await head.json()).toEqual({ vaultId, headSeq: 2, headHash: hash2 })

    const all = await app.request(`/api/v1/sync/ops?vaultId=${vaultId}&after=0`, await bearer(ada))
    expect(all.status).toBe(200)
    const page = await all.json() as { headSeq: number; ops: Array<{ seq: number; ciphertext: string; prevHash: string }> }
    expect(page.headSeq).toBe(2)
    expect(page.ops).toEqual([
      expect.objectContaining({ seq: 1, ciphertext: 'note-v1', prevHash: GENESIS_HASH, deviceId: deviceA }),
      expect.objectContaining({ seq: 2, ciphertext: 'note-v2', prevHash: hash1, deviceId: deviceA }),
    ])

    const rest = await app.request(`/api/v1/sync/ops?vaultId=${vaultId}&after=1`, await bearer(ada))
    const tail = await rest.json() as { ops: Array<{ seq: number; ciphertext: string }> }
    expect(tail.ops).toEqual([
      expect.objectContaining({ seq: 2, ciphertext: 'note-v2' }),
    ])
  })

  it('replays a clientOpId without advancing the head', async () => {
    const { vaultId } = await createVault()
    const first = op(1, deviceA, 'note-v1')
    await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [first] }),
    }))

    const replay = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [first] }),
    }))
    expect(replay.status).toBe(200)
    const replayed = await replay.json() as { ops: Array<{ seq: number }> }
    expect(replayed.ops[0]?.seq).toBe(1)

    const head = await app.request('/api/v1/sync', await bearer(ada))
    expect(await head.json()).toMatchObject({ headSeq: 1 })
    expect(await countRows(syncDb, 'sync_ops')).toBe(1)
  })

  it('pulls only the op appended by another device of the same account', async () => {
    const { vaultId } = await createVault()
    const deviceAToken = await signJwt(ada)
    const deviceBToken = await signJwt(ada)

    await app.request('/api/v1/sync/ops', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deviceAToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ vaultId, ops: [op(1, deviceA, 'from-a'), op(2, deviceA, 'from-a-2')] }),
    })

    const appended = await app.request('/api/v1/sync/ops', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deviceBToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ vaultId, ops: [op(3, deviceB, 'from-b')] }),
    })
    expect(appended.status).toBe(200)

    const pulled = await app.request(`/api/v1/sync/ops?vaultId=${vaultId}&after=2`, {
      headers: { authorization: `Bearer ${deviceAToken}` },
    })
    expect(pulled.status).toBe(200)
    const page = await pulled.json() as { ops: Array<{ seq: number; deviceId: string; ciphertext: string }> }
    expect(page.ops).toEqual([
      expect.objectContaining({ seq: 3, deviceId: deviceB, ciphertext: 'from-b' }),
    ])
  })

  it('drops ciphertext when the vault is reset and rejects the retired id', async () => {
    const { vaultId } = await createVault()
    const pushed = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [op(4, deviceA, 'secret-note')] }),
    }))
    expect(pushed.status).toBe(200)

    const reset = await app.request('/api/v1/vault/reset', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ ...vaultBody, wrappedKey: 'bmV3LWtleQ' }),
    }))
    expect(reset.status).toBe(201)
    const next = await reset.json() as { vaultId: string; headSeq: number }
    expect(next.vaultId).not.toBe(vaultId)
    expect(next.headSeq).toBe(0)

    const stalePush = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [op(5, deviceA, 'too-late')] }),
    }))
    expect(stalePush.status).toBe(409)
    expect((await stalePush.json() as { code: string }).code).toBe('vault_reset')

    const stalePull = await app.request(`/api/v1/sync/ops?vaultId=${vaultId}`, await bearer(ada))
    expect(stalePull.status).toBe(409)
    expect((await stalePull.json() as { code: string }).code).toBe('vault_reset')

    const fresh = await app.request(`/api/v1/sync/ops?vaultId=${next.vaultId}`, await bearer(ada))
    expect(fresh.status).toBe(200)
    expect(await fresh.json()).toEqual({ ops: [], headSeq: 0 })
  })

  it('hides one account vault from another account', async () => {
    const { vaultId } = await createVault()
    await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [op(6, deviceA, 'ada-only')] }),
    }))

    const missing = await app.request('/api/v1/vault', await bearer(bea))
    expect(missing.status).toBe(404)
    expect((await missing.json() as { code: string }).code).toBe('vault_not_found')

    const stolen = await app.request(`/api/v1/sync/ops?vaultId=${vaultId}`, await bearer(bea))
    expect(stolen.status).toBe(404)
    expect((await stolen.json() as { code: string }).code).toBe('vault_not_found')
  })

  it('rejects a batch that repeats clientOpId and writes nothing', async () => {
    const { vaultId } = await createVault()
    const duplicate = op(7, deviceA, 'once')
    const response = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [duplicate, { ...duplicate }] }),
    }))
    expect(response.status).toBe(400)
    expect((await response.json() as { code: string }).code).toBe('duplicate_client_op')

    const head = await app.request('/api/v1/sync', await bearer(ada))
    expect(await head.json()).toMatchObject({ headSeq: 0, headHash: GENESIS_HASH })
    expect(await countRows(syncDb, 'sync_ops')).toBe(0)
  })

  it('returns 400 for a non-UUID vault id after the bearer check', async () => {
    const unauthenticated = await app.request('/api/v1/sync/ops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vaultId: 'not-a-uuid', ops: [op(8, deviceA)] }),
    })
    expect(unauthenticated.status).toBe(401)

    const response = await app.request('/api/v1/sync/ops', await bearer(ada, {
      method: 'POST',
      body: JSON.stringify({ vaultId: 'not-a-uuid', ops: [op(8, deviceA)] }),
    }))
    expect(response.status).toBe(400)
    const body = await response.json() as { success: boolean }
    expect(body.success).toBe(false)
    expect(JSON.stringify(body)).toContain('Expected a UUID')
    expect(await countRows(syncDb, 'sync_ops')).toBe(0)
  })
})
