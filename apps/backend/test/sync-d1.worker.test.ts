/**
 * D1 binding checks. Runs in the Workers Vitest pool on Miniflare.
 * Requests enter through the worker fetch handler, so the log uses
 * withSession('first-primary') and D1 batch. The Node suite never does.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { applyD1Migrations, env, reset, SELF, type D1Migration } from 'cloudflare:test'
import { GENESIS_HASH } from '../src/app/core/sync.core'
import { chainHash } from '../src/app/core/sync.db'

const jwtSecret = new TextEncoder().encode('test-jwt-secret-at-least-32-characters-long')
const issuer = 'http://localhost:8787'

const ada = { id: 7, email: 'ada@example.com', name: 'Ada' }
const bea = { id: 8, email: 'bea@example.com', name: 'Bea' }
const deviceA = '00000000-0000-4000-8000-00000000000a'

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
    deviceId: deviceA,
    nonce: `nonce-${n}`,
    ciphertext,
  }
}

function migrations(): D1Migration[] {
  const value = (env as Cloudflare.Env & { TEST_MIGRATIONS?: D1Migration[] }).TEST_MIGRATIONS
  if (!Array.isArray(value)) {
    throw new Error('TEST_MIGRATIONS binding is missing from the worker test config')
  }
  return value
}

async function token(user: { id: number; email: string; name: string }): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwtSecret)
}

async function api(
  user: { id: number; email: string; name: string },
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${await token(user)}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await SELF.fetch(new Request(`http://example.com${path}`, { ...init, headers }))
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) as unknown : null,
  }
}

async function countOps(): Promise<number> {
  const row = await env.SYNC_DB.withSession('first-primary')
    .prepare('SELECT COUNT(*) AS n FROM sync_ops')
    .first<{ n: number | bigint }>()
  return Number(row?.n ?? 0)
}

describe('encrypted sync on the D1 binding', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.SYNC_DB, migrations())
  })

  afterEach(async () => {
    await reset()
  })

  it('reads the migrated vault table through a first-primary session', async () => {
    const row = await env.SYNC_DB.withSession('first-primary')
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vaults'")
      .first<{ name: string }>()
    expect(row?.name).toBe('vaults')
  })

  it('stores ciphertext through the worker fetch handler', async () => {
    const created = await api(ada, '/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify(vaultBody),
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const vault = created.body as { vaultId: string; headSeq: number; headHash: string }
    expect(vault.headSeq).toBe(0)
    expect(vault.headHash).toBe(GENESIS_HASH)

    const first = op(1, 'note-v1')
    const second = op(2, 'note-v2')
    const hash1 = await chainHash(GENESIS_HASH, 1, first.recordId, first.ciphertext)
    const hash2 = await chainHash(hash1, 2, second.recordId, second.ciphertext)

    const pushed = await api(ada, '/api/v1/sync/ops', {
      method: 'POST',
      body: JSON.stringify({ vaultId: vault.vaultId, ops: [first, second] }),
    })
    expect(pushed.status, JSON.stringify(pushed.body)).toBe(200)
    const ops = (pushed.body as { ops: Array<{ seq: number; prevHash: string }> }).ops
    expect(ops.map((row) => row.seq)).toEqual([1, 2])
    expect(ops[0]?.prevHash).toBe(GENESIS_HASH)
    expect(ops[1]?.prevHash).toBe(hash1)

    const head = await api(ada, '/api/v1/sync')
    expect(head.body).toEqual({ vaultId: vault.vaultId, headSeq: 2, headHash: hash2 })

    const pulled = await api(ada, `/api/v1/sync/ops?vaultId=${vault.vaultId}&after=0`)
    expect(pulled.status).toBe(200)
    expect(pulled.body).toMatchObject({
      headSeq: 2,
      ops: [
        { seq: 1, ciphertext: 'note-v1', prevHash: GENESIS_HASH },
        { seq: 2, ciphertext: 'note-v2', prevHash: hash1 },
      ],
    })
    expect(await countOps()).toBe(2)
  })

  it('replays a clientOpId without a second D1 row', async () => {
    const created = await api(ada, '/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify(vaultBody),
    })
    const vaultId = (created.body as { vaultId: string }).vaultId
    const first = op(1, 'note-v1')
    const body = JSON.stringify({ vaultId, ops: [first] })

    const pushed = await api(ada, '/api/v1/sync/ops', { method: 'POST', body })
    expect(pushed.status, JSON.stringify(pushed.body)).toBe(200)

    const replay = await api(ada, '/api/v1/sync/ops', { method: 'POST', body })
    expect(replay.status).toBe(200)
    expect((replay.body as { ops: Array<{ seq: number }> }).ops[0]?.seq).toBe(1)
    expect(await countOps()).toBe(1)
  })

  it('resets the vault in one D1 batch and rejects the retired id', async () => {
    const created = await api(ada, '/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify(vaultBody),
    })
    const vaultId = (created.body as { vaultId: string }).vaultId
    const pushed = await api(ada, '/api/v1/sync/ops', {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [op(3, 'secret-note')] }),
    })
    expect(pushed.status, JSON.stringify(pushed.body)).toBe(200)

    const resetVault = await api(ada, '/api/v1/vault/reset', {
      method: 'POST',
      body: JSON.stringify({ ...vaultBody, wrappedKey: 'bmV3LWtleQ' }),
    })
    expect(resetVault.status, JSON.stringify(resetVault.body)).toBe(201)
    const next = resetVault.body as { vaultId: string; headSeq: number }
    expect(next.vaultId).not.toBe(vaultId)
    expect(next.headSeq).toBe(0)
    expect(await countOps()).toBe(0)

    const stale = await api(ada, '/api/v1/sync/ops', {
      method: 'POST',
      body: JSON.stringify({ vaultId, ops: [op(4, 'too-late')] }),
    })
    expect(stale.status).toBe(409)
    expect((stale.body as { code: string }).code).toBe('vault_reset')

    const fresh = await api(ada, `/api/v1/sync/ops?vaultId=${next.vaultId}`)
    expect(fresh.body).toEqual({ ops: [], headSeq: 0 })
  })

  it('hides the vault from another account', async () => {
    const created = await api(ada, '/api/v1/vault', {
      method: 'PUT',
      body: JSON.stringify(vaultBody),
    })
    const vaultId = (created.body as { vaultId: string }).vaultId

    const missing = await api(bea, '/api/v1/vault')
    expect(missing.status).toBe(404)
    expect((missing.body as { code: string }).code).toBe('vault_not_found')

    const stolen = await api(bea, `/api/v1/sync/ops?vaultId=${vaultId}`)
    expect(stolen.status).toBe(404)
    expect((stolen.body as { code: string }).code).toBe('vault_not_found')
  })
})
