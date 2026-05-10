/**
 * Auth handler tests with multi-tenant infrastructure.
 *
 * Uses the real Hono app from route.ts via createApp() with a mock
 * Turso Platform API. Tests that auth flows correctly provision
 * tenant databases and that data is isolated between users.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { pushSQLiteSchema } from 'drizzle-kit/api'

import * as schema from '../../../db/schema/schema'
import { resetDbForTests } from '../../../core/common.db'
import { googleCalendarProvider } from '../../../core/calendar-providers/google.service'
import { createApp } from '../route'

// ---------------------------------------------------------------------------
// Mock Turso Platform API (creates local SQLite files instead of real DBs)
// ---------------------------------------------------------------------------
function createMockTursoApi(dataDir: string) {
  const app = new Hono()

  const dbFilePath = (name: string) => path.join(dataDir, `${name}.db`)
  const dbGroups = new Map<string, string>()

  app.get('/v1/organizations/:org/databases', (c) => {
    const groupFilter = c.req.query('group')
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.db'))
    let databases = files.map((f) => {
      const name = f.replace('.db', '')
      return { Name: name, group: dbGroups.get(name) ?? 'default' }
    })
    if (groupFilter) {
      databases = databases.filter((db) => db.group === groupFilter)
    }
    return c.json({ databases })
  })

  app.get('/v1/organizations/:org/databases/:name', (c) => {
    const dbPath = dbFilePath(c.req.param('name'))
    if (fs.existsSync(dbPath)) {
      return c.json({ Name: c.req.param('name') }, 200)
    }
    return c.json({ error: 'not found' }, 404)
  })

  app.post('/v1/organizations/:org/databases', async (c) => {
    const body = (await c.req.json()) as { name: string; group?: string; seed?: { type: string; name: string } }
    const dbPath = dbFilePath(body.name)

    if (body.seed?.name) {
      const seedPath = dbFilePath(body.seed.name)
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, dbPath)
      } else {
        fs.writeFileSync(dbPath, '')
      }
    } else {
      fs.writeFileSync(dbPath, '')
    }
    dbGroups.set(body.name, body.group ?? 'default')
    return c.json({ database: { Name: body.name } }, 200)
  })

  app.delete('/v1/organizations/:org/databases/:name', (c) => {
    const name = c.req.param('name')
    const dbPath = dbFilePath(name)
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    dbGroups.delete(name)
    return c.json({}, 200)
  })

  return app
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function pushSchemaToFile(filePath: string) {
  const client = createClient({ url: `file:${filePath}` })
  const db = drizzle({ client, schema, casing: 'snake_case' })
  const { apply } = await pushSQLiteSchema(schema, db as Parameters<typeof pushSQLiteSchema>[1])
  await apply()
}

function getSessionToken(res: Response): string | null {
  return res.headers.get('set-auth-token')
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Auth with multi-tenant provisioning', () => {
  let tmpDir: string
  let mockServer: ReturnType<typeof serve>
  let mockPort: number

  const savedEnv: Record<string, string | undefined> = {}
  const envKeys = [
    'SQLITE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'TRUSTED_ORIGINS',
    'JWT_SECRET',
    'TURSO_MAIN_DB_URL',
    'TURSO_MAIN_DB_AUTH_TOKEN',
    'TURSO_ORG_SLUG',
    'TURSO_API_TOKEN',
    'TURSO_GROUP',
    'TURSO_GROUP_AUTH_TOKEN',
    'TURSO_TENANT_DB_URL',
    'TURSO_SEED_DB_NAME',
  ]

  let request: (input: Request) => Promise<Response>
  let appResult: ReturnType<typeof createApp>

  beforeAll(async () => {
    for (const key of envKeys) savedEnv[key] = process.env[key]

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'techoo-auth-mt-'))
    const dbDir = path.join(tmpDir, 'dbs')
    fs.mkdirSync(dbDir, { recursive: true })

    const mockApp = createMockTursoApi(dbDir)
    mockServer = serve({ fetch: mockApp.fetch, port: 0 })
    const addr = mockServer.address()
    mockPort = typeof addr === 'object' && addr ? addr.port : 19876

    const seedDbName = 'techoo-test-seed'
    const seedPath = path.join(dbDir, `${seedDbName}.db`)
    await pushSchemaToFile(seedPath)

    const mainDbPath = path.join(tmpDir, 'main.db')
    await pushSchemaToFile(mainDbPath)

    const env = process.env as Record<string, string | undefined>
    env.SQLITE_URL = `file:${mainDbPath}`
    env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long'
    env.BETTER_AUTH_URL = 'http://localhost'
    env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    env.GOOGLE_REDIRECT_URI = 'http://localhost/api/auth/callback/google'
    env.TRUSTED_ORIGINS = 'http://localhost'
    env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
    env.TURSO_MAIN_DB_URL = `file:${mainDbPath}`
    env.TURSO_MAIN_DB_AUTH_TOKEN = 'unused-for-file-urls'
    env.TURSO_ORG_SLUG = 'test-org'
    env.TURSO_API_TOKEN = 'fake-api-token'
    env.TURSO_GROUP = 'default'
    env.TURSO_GROUP_AUTH_TOKEN = 'fake-group-auth-token'
    env.TURSO_TENANT_DB_URL = `file:${dbDir}/{tenant}.db`
    env.TURSO_SEED_DB_NAME = seedDbName
    env.TURSO_API_BASE_URL = `http://127.0.0.1:${mockPort}`

    resetDbForTests()

    appResult = createApp({ skipEnvValidation: true })
    request = (input: Request) => appResult.app.request(input) as Promise<Response>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    resetDbForTests()
    if (mockServer) mockServer.close()
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  async function signUp(email: string, password: string, name: string) {
    return request(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
    )
  }

  async function signIn(email: string, password: string) {
    return request(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    )
  }

  async function getJwt(sessionToken: string): Promise<string> {
    const res = await request(
      new Request('http://localhost/api/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
    )
    const data = await res.json()
    return data.token
  }

  function authHeaders(jwt: string): Record<string, string> {
    return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
  }

  async function mockGoogleProvider() {
    const authContext = await (appResult.auth as unknown as { $context: Promise<any> }).$context
    const provider = authContext.socialProviders.find(
      (item: { id: string }) => item.id === 'google'
    ) as any
    if (!provider.verifyIdToken) provider.verifyIdToken = async () => true
    if (!provider.getUserInfo) provider.getUserInfo = async () => null
    return provider
  }

  // -----------------------------------------------------------------------
  // Email sign-up + tenant provisioning
  // -----------------------------------------------------------------------
  describe('Email sign-up', () => {
    it('should sign up and create a tenant database', async () => {
      const res = await signUp('alice@example.com', 'password123456', 'Alice')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.user.email).toBe('alice@example.com')
      expect(getSessionToken(res)).toBeTruthy()

      const userId = Number(data.user.id)
      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)
    })

    it('should exchange session token for JWT', async () => {
      const res = await signUp('bob@example.com', 'password123456', 'Bob')
      const jwt = await getJwt(getSessionToken(res)!)
      expect(jwt).toBeTruthy()
      expect(jwt.split('.')).toHaveLength(3)
    })

    it('should reject duplicate email', async () => {
      await signUp('dup@example.com', 'password123456', 'Dup')
      const second = await signUp('dup@example.com', 'password123456', 'Dup')
      expect(second.status).not.toBe(200)
    })

    it('should complete sign-up → sign-in → JWT → protected access', async () => {
      await signUp('flow@example.com', 'password123456', 'Flow')
      const signInRes = await signIn('flow@example.com', 'password123456')
      expect(signInRes.status).toBe(200)

      const jwt = await getJwt(getSessionToken(signInRes)!)

      const todosRes = await request(
        new Request('http://localhost/api/v1/todos', { headers: authHeaders(jwt) })
      )
      expect(todosRes.status).toBe(200)
      expect((await todosRes.json()).data).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // OAuth link (existing user)
  // -----------------------------------------------------------------------
  describe('OAuth link flow', () => {
    it('should link a Google account and store providerEmail', async () => {
      const signUpRes = await signUp('oauth-link@example.com', 'password123456', 'OAuth Link')
      const sessionToken = getSessionToken(signUpRes)!

      const provider = await mockGoogleProvider()
      vi.spyOn(provider, 'verifyIdToken').mockResolvedValue(true)
      vi.spyOn(provider, 'getUserInfo').mockResolvedValue({
        user: { id: 'google-link-1', email: 'oauth-link@gmail.com', emailVerified: true, name: 'OAuth Link' },
      })
      vi.spyOn(googleCalendarProvider, 'getUserInfo').mockResolvedValue({ email: 'oauth-link@gmail.com' })

      const linkRes = await request(
        new Request('http://localhost/api/auth/link-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}`, Origin: 'http://localhost' },
          body: JSON.stringify({ provider: 'google', disableRedirect: true, idToken: { token: 'fake', accessToken: 'fake' } }),
        })
      )
      expect(linkRes.status).toBe(200)

      const jwt = await getJwt(sessionToken)
      const accountsRes = await request(
        new Request('http://localhost/api/oauth/google/accounts', { headers: authHeaders(jwt) })
      )
      expect(accountsRes.status).toBe(200)
      const { accounts } = await accountsRes.json()
      expect(accounts).toHaveLength(1)
      expect(accounts[0].accountId).toBe('google-link-1')
      expect(accounts[0].email).toBe('oauth-link@gmail.com')
    })
  })

  // -----------------------------------------------------------------------
  // OAuth sign-up (new user via Google) — tenant provisioned at /token
  // -----------------------------------------------------------------------
  describe('OAuth sign-up (new user via Google)', () => {
    it('should create user, provision tenant at /token, and access data', async () => {
      const provider = await mockGoogleProvider()
      vi.spyOn(provider, 'verifyIdToken').mockResolvedValue(true)
      vi.spyOn(provider, 'getUserInfo').mockResolvedValue({
        user: { id: 'google-new-1', email: 'google-new@example.com', emailVerified: true, name: 'Google New' },
      })
      vi.spyOn(googleCalendarProvider, 'getUserInfo').mockResolvedValue({ email: 'google-new@example.com' })

      const socialRes = await request(
        new Request('http://localhost/api/auth/sign-in/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
          body: JSON.stringify({ provider: 'google', disableRedirect: true, idToken: { token: 'fake', accessToken: 'fake' } }),
        })
      )
      expect(socialRes.status).toBe(200)
      const socialData = await socialRes.json()
      expect(socialData.user.email).toBe('google-new@example.com')

      // /token provisions the tenant for OAuth sign-ups
      const jwt = await getJwt(getSessionToken(socialRes)!)
      expect(jwt).toBeTruthy()

      const userId = Number(socialData.user.id)
      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)

      // Verify user can create tasks in their tenant
      const todoRes = await request(
        new Request('http://localhost/api/v1/todos', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'OAuth user todo' }),
        })
      )
      expect(todoRes.status).toBe(201)
    })

    it('should not re-provision on subsequent sign-in', async () => {
      const signUpRes = await signUp('repeat@example.com', 'password123456', 'Repeat')
      const signUpData = await signUpRes.json()
      const userId = Number(signUpData.user.id)

      await getJwt(getSessionToken(signUpRes)!)

      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)

      const signInRes = await signIn('repeat@example.com', 'password123456')
      const jwt2 = await getJwt(getSessionToken(signInRes)!)

      const todosRes = await request(
        new Request('http://localhost/api/v1/todos', { headers: authHeaders(jwt2) })
      )
      expect(todosRes.status).toBe(200)
    })
  })

  // -----------------------------------------------------------------------
  // Tenant isolation
  // -----------------------------------------------------------------------
  describe('Tenant isolation', () => {
    let jwtA: string
    let jwtB: string

    beforeAll(async () => {
      const resA = await signUp('tenant-a@example.com', 'password123456', 'TenantA')
      jwtA = await getJwt(getSessionToken(resA)!)

      const resB = await signUp('tenant-b@example.com', 'password123456', 'TenantB')
      jwtB = await getJwt(getSessionToken(resB)!)
    })

    it('should isolate todos between users', async () => {
      await request(new Request('http://localhost/api/v1/todos', {
        method: 'POST', headers: authHeaders(jwtA), body: JSON.stringify({ title: 'A-only todo' }),
      }))
      await request(new Request('http://localhost/api/v1/todos', {
        method: 'POST', headers: authHeaders(jwtB), body: JSON.stringify({ title: 'B-only todo' }),
      }))

      const listA = await request(new Request('http://localhost/api/v1/todos', { headers: authHeaders(jwtA) }))
      const dataA = await listA.json()
      expect(dataA.data).toHaveLength(1)
      expect(dataA.data[0].title).toBe('A-only todo')

      const listB = await request(new Request('http://localhost/api/v1/todos', { headers: authHeaders(jwtB) }))
      const dataB = await listB.json()
      expect(dataB.data).toHaveLength(1)
      expect(dataB.data[0].title).toBe('B-only todo')
    })

    it('should not allow user A to see user B todos', async () => {
      // User B creates a todo
      await request(new Request('http://localhost/api/v1/todos', {
        method: 'POST', headers: authHeaders(jwtB), body: JSON.stringify({ title: 'Secret B todo' }),
      }))

      // User A lists todos — should not see B's todo
      const listA = await request(new Request('http://localhost/api/v1/todos', { headers: authHeaders(jwtA) }))
      const dataA = await listA.json()
      const titles = dataA.data.map((t: { title: string }) => t.title)
      expect(titles).not.toContain('Secret B todo')
    })
  })
})
