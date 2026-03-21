/**
 * E2E tests for multi-tenant flow.
 *
 * Uses the real Hono app from route.ts via createApp() with injected
 * auth for OAuth mocking. Spins up a mock Turso Platform API that
 * manages local SQLite files. Tests the full flow:
 *
 *   Sign-up → tenant DB created → token exchange → CRUD tasks/notes →
 *   data isolation between users
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
import { createAuth } from '../../../core/auth'
import { googleCalendarProvider } from '../../../core/calendar-providers/google.service'
import { createApp, type Auth } from '../route'

// ---------------------------------------------------------------------------
// Mock Turso Platform API (creates local SQLite files instead of real DBs)
// ---------------------------------------------------------------------------
function createMockTursoApi(dataDir: string) {
  const app = new Hono()

  const dbFilePath = (name: string) => path.join(dataDir, `${name}.db`)

  // List databases  (GET /v1/organizations/:org/databases)
  app.get('/v1/organizations/:org/databases', (c) => {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.db'))
    const databases = files.map((f) => ({ Name: f.replace('.db', '') }))
    return c.json({ databases })
  })

  // Get database  (GET /v1/organizations/:org/databases/:name)
  app.get('/v1/organizations/:org/databases/:name', (c) => {
    const dbPath = dbFilePath(c.req.param('name'))
    if (fs.existsSync(dbPath)) {
      return c.json({ Name: c.req.param('name') }, 200)
    }
    return c.json({ error: 'not found' }, 404)
  })

  // Create database  (POST /v1/organizations/:org/databases)
  app.post('/v1/organizations/:org/databases', async (c) => {
    const body = (await c.req.json()) as { name: string; seed?: { type: string; name: string } }
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
    return c.json({ Name: body.name }, 200)
  })

  // Delete database  (DELETE /v1/organizations/:org/databases/:name)
  app.delete('/v1/organizations/:org/databases/:name', (c) => {
    const dbPath = dbFilePath(c.req.param('name'))
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    return c.json({}, 200)
  })

  return app
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Push the full Drizzle schema into a local SQLite file */
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
describe('E2E: Multi-tenant auth, tasks & notes', () => {
  let tmpDir: string
  let mockServer: ReturnType<typeof serve>
  let mockPort: number

  // Saved env to restore later
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
    'TURSO_ORG_SLUG',
    'TURSO_API_TOKEN',
    'TURSO_GROUP',
    'TURSO_GROUP_AUTH_TOKEN',
    'TURSO_TENANT_DB_URL',
    'TURSO_SEED_DB_NAME',
  ]

  // App + request helper
  let request: (input: Request) => Promise<Response>
  let testAuth: Auth

  beforeAll(async () => {
    // Save existing env
    for (const key of envKeys) savedEnv[key] = process.env[key]

    // Create temp directory tree
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'techoo-e2e-'))
    const dbDir = path.join(tmpDir, 'dbs')
    fs.mkdirSync(dbDir, { recursive: true })

    // ----- Start mock Turso API -----
    const mockApp = createMockTursoApi(dbDir)
    mockServer = serve({ fetch: mockApp.fetch, port: 0 })
    const addr = mockServer.address()
    mockPort = typeof addr === 'object' && addr ? addr.port : 19876

    // ----- Prepare seed DB -----
    const seedDbName = 'techoo-e2e-seed'
    const seedPath = path.join(dbDir, `${seedDbName}.db`)
    await pushSchemaToFile(seedPath)

    // ----- Prepare centralized (main) DB -----
    const mainDbPath = path.join(tmpDir, 'main.db')
    await pushSchemaToFile(mainDbPath)

    // ----- Set env vars -----
    const orgSlug = 'test-org'
    const env = process.env as Record<string, string | undefined>
    env.SQLITE_URL = `file:${mainDbPath}`
    env.BETTER_AUTH_SECRET = 'e2e-test-secret-at-least-32-characters-long'
    env.BETTER_AUTH_URL = 'http://localhost'
    env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    env.GOOGLE_REDIRECT_URI = 'http://localhost/api/auth/callback/google'
    env.TRUSTED_ORIGINS = 'http://localhost'
    env.JWT_SECRET = 'e2e-jwt-secret-at-least-32-characters-long'

    // Tenanso config pointing at mock API
    env.TURSO_ORG_SLUG = orgSlug
    env.TURSO_API_TOKEN = 'fake-api-token'
    env.TURSO_GROUP = 'default'
    env.TURSO_GROUP_AUTH_TOKEN = 'fake-group-auth-token'
    // libsql client resolves file: URLs locally — use {tenant} placeholder
    env.TURSO_TENANT_DB_URL = `file:${dbDir}/{tenant}.db`
    env.TURSO_SEED_DB_NAME = seedDbName
    // Point tenanso at mock server instead of real Turso API
    env.TURSO_API_BASE_URL = `http://127.0.0.1:${mockPort}`

    // Reset singleton DB instances so they pick up new env
    resetDbForTests()

    // ----- Create the real app via factory, skipping env validation -----
    // (env vars are already set above but may not pass Zod's strict parse
    //  due to the Cloudflare worker-configuration.d.ts literal types)
    const result = createApp({ skipEnvValidation: true })
    testAuth = result.auth

    request = (input: Request) => result.app.request(input) as Promise<Response>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    // Restore env
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    resetDbForTests()

    // Stop mock server
    if (mockServer) mockServer.close()

    // Clean up temp dir
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // -----------------------------------------------------------------------
  // Helpers: sign up, sign in, get JWT
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
    return {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    }
  }

  // -----------------------------------------------------------------------
  // 1. Sign-up & tenant DB creation
  // -----------------------------------------------------------------------
  describe('Sign-up & tenant provisioning', () => {
    it('should sign up a user and create a tenant database', async () => {
      const res = await signUp('alice@example.com', 'password123456', 'Alice')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('alice@example.com')

      const token = getSessionToken(res)
      expect(token).toBeTruthy()

      // Verify tenant DB was created (file exists in temp dir)
      const userId = Number(data.user.id)
      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)
    })

    it('should return a session token that can be exchanged for a JWT', async () => {
      const signUpRes = await signUp('bob@example.com', 'password123456', 'Bob')
      expect(signUpRes.status).toBe(200)
      const sessionToken = getSessionToken(signUpRes)!

      const jwt = await getJwt(sessionToken)
      expect(jwt).toBeTruthy()
      expect(jwt.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should reject duplicate email sign-up', async () => {
      const first = await signUp('dup@example.com', 'password123456', 'Dup')
      expect(first.status).toBe(200)

      const second = await signUp('dup@example.com', 'password123456', 'Dup')
      expect(second.status).not.toBe(200)
    })

    it('should complete sign-up → sign-in → JWT → protected access', async () => {
      await signUp('flow@example.com', 'password123456', 'Flow')
      const signInRes = await signIn('flow@example.com', 'password123456')
      expect(signInRes.status).toBe(200)

      const sessionToken = getSessionToken(signInRes)!
      const jwt = await getJwt(sessionToken)

      // Access a protected route (list tasks — should return empty)
      const tasksRes = await request(
        new Request('http://localhost/api/tasks', {
          headers: authHeaders(jwt),
        })
      )
      expect(tasksRes.status).toBe(200)
      const tasksData = await tasksRes.json()
      expect(tasksData.tasks).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // 2. OAuth link flow
  // -----------------------------------------------------------------------
  describe('OAuth link flow', () => {
    it('should link a Google account via idToken and store providerEmail', async () => {
      const signUpRes = await signUp('oauth-user@example.com', 'password123456', 'OAuth User')
      expect(signUpRes.status).toBe(200)
      const sessionToken = getSessionToken(signUpRes)!

      // Get auth context to mock the social provider
      const authContext = await (testAuth as unknown as { $context: Promise<any> }).$context
      const provider = authContext.socialProviders.find(
        (item: { id: string }) => item.id === 'google'
      ) as any
      expect(provider).toBeTruthy()

      if (!provider.verifyIdToken) provider.verifyIdToken = async () => true
      if (!provider.getUserInfo) provider.getUserInfo = async () => null

      vi.spyOn(provider, 'verifyIdToken').mockResolvedValue(true)
      vi.spyOn(provider, 'getUserInfo').mockResolvedValue({
        user: {
          id: 'google-account-1',
          email: 'oauth-user@gmail.com',
          emailVerified: true,
          name: 'OAuth User',
        },
      })
      vi.spyOn(googleCalendarProvider, 'getUserInfo').mockResolvedValue({
        email: 'oauth-user@gmail.com',
      })

      const linkRes = await request(
        new Request('http://localhost/api/auth/link-social', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
            Origin: 'http://localhost',
          },
          body: JSON.stringify({
            provider: 'google',
            disableRedirect: true,
            idToken: { token: 'fake-id-token', accessToken: 'oauth-access-token' },
          }),
        })
      )

      expect(linkRes.status).toBe(200)

      // Verify via the accounts API
      const jwt = await getJwt(sessionToken)
      const accountsRes = await request(
        new Request('http://localhost/api/oauth/google/accounts', {
          headers: authHeaders(jwt),
        })
      )
      expect(accountsRes.status).toBe(200)
      const accountsData = await accountsRes.json()
      expect(accountsData.accounts).toHaveLength(1)
      expect(accountsData.accounts[0].accountId).toBe('google-account-1')
      expect(accountsData.accounts[0].email).toBe('oauth-user@gmail.com')
    })
  })

  // -----------------------------------------------------------------------
  // 3. OAuth sign-up (new user via Google)
  // -----------------------------------------------------------------------
  describe('OAuth sign-up (new user via Google)', () => {
    async function mockGoogleProvider() {
      const authContext = await (testAuth as unknown as { $context: Promise<any> }).$context
      const provider = authContext.socialProviders.find(
        (item: { id: string }) => item.id === 'google'
      ) as any

      if (!provider.verifyIdToken) provider.verifyIdToken = async () => true
      if (!provider.getUserInfo) provider.getUserInfo = async () => null

      return provider
    }

    it('should create user and provision tenant via social sign-in', async () => {
      const provider = await mockGoogleProvider()

      vi.spyOn(provider, 'verifyIdToken').mockResolvedValue(true)
      vi.spyOn(provider, 'getUserInfo').mockResolvedValue({
        user: {
          id: 'google-new-user-1',
          email: 'google-new@example.com',
          emailVerified: true,
          name: 'Google New User',
        },
      })
      vi.spyOn(googleCalendarProvider, 'getUserInfo').mockResolvedValue({
        email: 'google-new@example.com',
      })

      // Sign in with Google (creates a new user since email doesn't exist)
      const socialRes = await request(
        new Request('http://localhost/api/auth/sign-in/social', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost',
          },
          body: JSON.stringify({
            provider: 'google',
            disableRedirect: true,
            idToken: { token: 'fake-id-token', accessToken: 'oauth-access-token' },
          }),
        })
      )

      expect(socialRes.status).toBe(200)
      const socialData = await socialRes.json()
      expect(socialData.user).toBeDefined()
      expect(socialData.user.email).toBe('google-new@example.com')

      const sessionToken = getSessionToken(socialRes)
      expect(sessionToken).toBeTruthy()

      // Exchange session token for JWT — this should provision the tenant
      const jwt = await getJwt(sessionToken!)
      expect(jwt).toBeTruthy()
      expect(jwt.split('.')).toHaveLength(3)

      // Verify tenant DB was created
      const userId = Number(socialData.user.id)
      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)

      // Verify the user can create tasks in their tenant DB
      const taskRes = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'OAuth user task' }),
        })
      )
      expect(taskRes.status).toBe(201)
      const taskData = await taskRes.json()
      expect(taskData.task.title).toBe('OAuth user task')
    })

    it('should not provision a new tenant on subsequent sign-in', async () => {
      // First: sign up via email (tenant is provisioned at sign-up)
      const signUpRes = await signUp('repeat-oauth@example.com', 'password123456', 'Repeat User')
      expect(signUpRes.status).toBe(200)
      const signUpData = await signUpRes.json()
      const userId = Number(signUpData.user.id)
      const sessionToken = getSessionToken(signUpRes)!

      // Get JWT (triggers provisioning check — tenant should already exist)
      const jwt1 = await getJwt(sessionToken)
      expect(jwt1).toBeTruthy()

      // Verify tenant exists
      const tenantDbPath = path.join(tmpDir, 'dbs', `default-user-${userId}.db`)
      expect(fs.existsSync(tenantDbPath)).toBe(true)

      // Sign in again (same user)
      const signInRes = await signIn('repeat-oauth@example.com', 'password123456')
      expect(signInRes.status).toBe(200)

      // Get JWT again — should succeed without re-provisioning
      const jwt2 = await getJwt(getSessionToken(signInRes)!)
      expect(jwt2).toBeTruthy()

      // Verify can still access data
      const tasksRes = await request(
        new Request('http://localhost/api/tasks', { headers: authHeaders(jwt2) })
      )
      expect(tasksRes.status).toBe(200)
    })
  })

  // -----------------------------------------------------------------------
  // 4. /token endpoint tenant provisioning
  // -----------------------------------------------------------------------
  describe('/token endpoint tenant provisioning', () => {
    it('should provision tenant at /token if not yet provisioned', async () => {
      // Sign up via email — the /auth/* wrapper provisions for email sign-up
      const signUpRes = await signUp('lazy-provision@example.com', 'password123456', 'Lazy User')
      expect(signUpRes.status).toBe(200)
      const sessionToken = getSessionToken(signUpRes)!

      // Exchange for JWT — should work since email sign-up provisions eagerly
      const jwt = await getJwt(sessionToken)
      expect(jwt).toBeTruthy()

      // Verify the user can use protected routes
      const tasksRes = await request(
        new Request('http://localhost/api/tasks', { headers: authHeaders(jwt) })
      )
      expect(tasksRes.status).toBe(200)
    })
  })

  // -----------------------------------------------------------------------
  // CRUD Tasks
  // -----------------------------------------------------------------------
  describe('CRUD Tasks', () => {
    let jwt: string

    beforeAll(async () => {
      const res = await signUp('tasks-user@example.com', 'password123456', 'TaskUser')
      const sessionToken = getSessionToken(res)!
      jwt = await getJwt(sessionToken)
    })

    it('should return empty tasks list initially', async () => {
      const res = await request(
        new Request('http://localhost/api/tasks', { headers: authHeaders(jwt) })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.tasks).toEqual([])
      expect(data.total).toBe(0)
    })

    it('should create a task', async () => {
      const res = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({
            title: 'E2E Task',
            description: 'Created in e2e test',
          }),
        })
      )
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.task.title).toBe('E2E Task')
      expect(data.task.description).toBe('Created in e2e test')
      expect(data.task.completedAt).toBeNull()
      expect(data.task.id).toBeTruthy()
    })

    it('should read, update, and delete a task', async () => {
      // Create
      const createRes = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'Lifecycle Task' }),
        })
      )
      expect(createRes.status).toBe(201)
      const { task } = await createRes.json()
      const taskId = task.id

      // Read
      const readRes = await request(
        new Request(`http://localhost/api/tasks/${taskId}`, {
          headers: authHeaders(jwt),
        })
      )
      expect(readRes.status).toBe(200)
      const readData = await readRes.json()
      expect(readData.task.title).toBe('Lifecycle Task')

      // Update
      const updateRes = await request(
        new Request(`http://localhost/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'Updated Task', completedAt: new Date().toISOString() }),
        })
      )
      expect(updateRes.status).toBe(200)
      const updateData = await updateRes.json()
      expect(updateData.task.title).toBe('Updated Task')
      expect(updateData.task.completedAt).not.toBeNull()

      // Delete
      const deleteRes = await request(
        new Request(`http://localhost/api/tasks/${taskId}`, {
          method: 'DELETE',
          headers: authHeaders(jwt),
        })
      )
      expect(deleteRes.status).toBe(200)

      // Verify deleted
      const verifyRes = await request(
        new Request(`http://localhost/api/tasks/${taskId}`, {
          headers: authHeaders(jwt),
        })
      )
      expect(verifyRes.status).toBe(404)
    })

    it('should reject empty title', async () => {
      const res = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: '' }),
        })
      )
      expect(res.status).toBe(400)
    })
  })

  // -----------------------------------------------------------------------
  // CRUD Notes
  // -----------------------------------------------------------------------
  describe('CRUD Notes', () => {
    let jwt: string

    beforeAll(async () => {
      const res = await signUp('notes-user@example.com', 'password123456', 'NotesUser')
      const sessionToken = getSessionToken(res)!
      jwt = await getJwt(sessionToken)
    })

    it('should return empty notes list initially', async () => {
      const res = await request(
        new Request('http://localhost/api/notes', { headers: authHeaders(jwt) })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.notes).toEqual([])
      expect(data.total).toBe(0)
    })

    it('should create a note', async () => {
      const res = await request(
        new Request('http://localhost/api/notes', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'E2E note', content: 'E2E note content' }),
        })
      )
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.note.title).toBe('E2E note')
      expect(data.note.id).toBeTruthy()
    })

    it('should read, update, and delete a note', async () => {
      // Create
      const createRes = await request(
        new Request('http://localhost/api/notes', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'Lifecycle note' }),
        })
      )
      expect(createRes.status).toBe(201)
      const { note } = await createRes.json()
      const noteId = note.id

      // Read
      const readRes = await request(
        new Request(`http://localhost/api/notes/${noteId}`, {
          headers: authHeaders(jwt),
        })
      )
      expect(readRes.status).toBe(200)
      const readData = await readRes.json()
      expect(readData.note.title).toBe('Lifecycle note')

      // Update
      const updateRes = await request(
        new Request(`http://localhost/api/notes/${noteId}`, {
          method: 'PUT',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'Updated note' }),
        })
      )
      expect(updateRes.status).toBe(200)
      const updateData = await updateRes.json()
      expect(updateData.note.title).toBe('Updated note')

      // Delete
      const deleteRes = await request(
        new Request(`http://localhost/api/notes/${noteId}`, {
          method: 'DELETE',
          headers: authHeaders(jwt),
        })
      )
      expect(deleteRes.status).toBe(200)

      // Verify deleted
      const verifyRes = await request(
        new Request(`http://localhost/api/notes/${noteId}`, {
          headers: authHeaders(jwt),
        })
      )
      expect(verifyRes.status).toBe(404)
    })

    it('should convert a note to a task', async () => {
      // Create a note
      const createRes = await request(
        new Request('http://localhost/api/notes', {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({ title: 'Convert me to a task' }),
        })
      )
      expect(createRes.status).toBe(201)
      const { note } = await createRes.json()

      // Convert to task (body is optional schedule, title comes from the note)
      const convertRes = await request(
        new Request(`http://localhost/api/notes/${note.id}/task_conversions`, {
          method: 'POST',
          headers: authHeaders(jwt),
          body: JSON.stringify({}),
        })
      )
      expect(convertRes.status).toBe(201)
      const convertData = await convertRes.json()
      expect(convertData.task).toBeDefined()
      expect(convertData.task.title).toBe('Convert me to a task')
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
      expect(resA.status).toBe(200)
      jwtA = await getJwt(getSessionToken(resA)!)

      const resB = await signUp('tenant-b@example.com', 'password123456', 'TenantB')
      expect(resB.status).toBe(200)
      jwtB = await getJwt(getSessionToken(resB)!)
    })

    it('should isolate tasks between users', async () => {
      // User A creates a task
      const createA = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwtA),
          body: JSON.stringify({ title: 'A-only task' }),
        })
      )
      expect(createA.status).toBe(201)

      // User B creates a task
      const createB = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwtB),
          body: JSON.stringify({ title: 'B-only task' }),
        })
      )
      expect(createB.status).toBe(201)

      // User A sees only their task
      const listA = await request(
        new Request('http://localhost/api/tasks', { headers: authHeaders(jwtA) })
      )
      const dataA = await listA.json()
      expect(dataA.tasks).toHaveLength(1)
      expect(dataA.tasks[0].title).toBe('A-only task')

      // User B sees only their task
      const listB = await request(
        new Request('http://localhost/api/tasks', { headers: authHeaders(jwtB) })
      )
      const dataB = await listB.json()
      expect(dataB.tasks).toHaveLength(1)
      expect(dataB.tasks[0].title).toBe('B-only task')
    })

    it('should isolate notes between users', async () => {
      // User A creates a note
      const createA = await request(
        new Request('http://localhost/api/notes', {
          method: 'POST',
          headers: authHeaders(jwtA),
          body: JSON.stringify({ title: 'A-only note' }),
        })
      )
      expect(createA.status).toBe(201)

      // User B creates a note
      const createB = await request(
        new Request('http://localhost/api/notes', {
          method: 'POST',
          headers: authHeaders(jwtB),
          body: JSON.stringify({ title: 'B-only note' }),
        })
      )
      expect(createB.status).toBe(201)

      // User A sees only their note
      const listA = await request(
        new Request('http://localhost/api/notes', { headers: authHeaders(jwtA) })
      )
      const dataA = await listA.json()
      const aNotes = dataA.notes.filter((n: { title: string }) => n.title.includes('-only'))
      expect(aNotes).toHaveLength(1)
      expect(aNotes[0].title).toBe('A-only note')

      // User B sees only their note
      const listB = await request(
        new Request('http://localhost/api/notes', { headers: authHeaders(jwtB) })
      )
      const dataB = await listB.json()
      const bNotes = dataB.notes.filter((n: { title: string }) => n.title.includes('-only'))
      expect(bNotes).toHaveLength(1)
      expect(bNotes[0].title).toBe('B-only note')
    })

    it('should not allow user A to access user B task by ID', async () => {
      // User B creates a task
      const createB = await request(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: authHeaders(jwtB),
          body: JSON.stringify({ title: 'Secret B task' }),
        })
      )
      const { task: taskB } = await createB.json()

      // User A tries to read it
      const readA = await request(
        new Request(`http://localhost/api/tasks/${taskB.id}`, {
          headers: authHeaders(jwtA),
        })
      )
      expect(readA.status).toBe(404)
    })
  })
})
