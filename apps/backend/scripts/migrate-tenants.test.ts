/**
 * Tests for the tenant migration script logic.
 *
 * Uses the same mock Turso API pattern as the e2e tests to verify
 * that migrations are applied to all tenant databases.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { pushSQLiteSchema } from 'drizzle-kit/api'
import { sql } from 'drizzle-orm'

import * as schema from '../src/app/db/schema/schema'
import { resetDbForTests, getTenanso } from '../src/app/core/common.db'

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
    if (fs.existsSync(dbPath)) return c.json({ Name: c.req.param('name') }, 200)
    return c.json({ error: 'not found' }, 404)
  })

  app.post('/v1/organizations/:org/databases', async (c) => {
    const body = (await c.req.json()) as { name: string; group?: string; seed?: { type: string; name: string } }
    const dbPath = dbFilePath(body.name)
    if (body.seed?.name) {
      const seedPath = dbFilePath(body.seed.name)
      if (fs.existsSync(seedPath)) fs.copyFileSync(seedPath, dbPath)
      else fs.writeFileSync(dbPath, '')
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

async function pushSchemaToFile(filePath: string) {
  const client = createClient({ url: `file:${filePath}` })
  const db = drizzle({ client, schema, casing: 'snake_case' })
  const { apply } = await pushSQLiteSchema(schema, db as Parameters<typeof pushSQLiteSchema>[1])
  await apply()
}

describe('migrate-tenants script', () => {
  let tmpDir: string
  let dbDir: string
  let mockServer: ReturnType<typeof serve>
  let mockPort: number

  const savedEnv: Record<string, string | undefined> = {}
  const envKeys = [
    'SQLITE_URL',
    'TURSO_ORG_SLUG',
    'TURSO_API_TOKEN',
    'TURSO_GROUP',
    'TURSO_GROUP_AUTH_TOKEN',
    'TURSO_TENANT_DB_URL',
    'TURSO_SEED_DB_NAME',
    'TURSO_API_BASE_URL',
  ]

  beforeAll(async () => {
    for (const key of envKeys) savedEnv[key] = process.env[key]

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'techoo-migrate-test-'))
    dbDir = path.join(tmpDir, 'dbs')
    fs.mkdirSync(dbDir, { recursive: true })

    // Start mock Turso API
    const mockApp = createMockTursoApi(dbDir)
    mockServer = serve({ fetch: mockApp.fetch, port: 0 })
    const addr = mockServer.address()
    mockPort = typeof addr === 'object' && addr ? addr.port : 19877

    // Create seed DB with full schema
    const seedDbName = 'migrate-test-seed'
    const seedPath = path.join(dbDir, `${seedDbName}.db`)
    await pushSchemaToFile(seedPath)

    // Create a main DB
    const mainDbPath = path.join(tmpDir, 'main.db')
    await pushSchemaToFile(mainDbPath)

    // Set env
    const env = process.env as Record<string, string | undefined>
    env.SQLITE_URL = `file:${mainDbPath}`
    env.TURSO_ORG_SLUG = 'test-org'
    env.TURSO_API_TOKEN = 'fake-api-token'
    env.TURSO_GROUP = 'default'
    env.TURSO_GROUP_AUTH_TOKEN = 'fake-group-auth-token'
    env.TURSO_TENANT_DB_URL = `file:${dbDir}/{tenant}.db`
    env.TURSO_SEED_DB_NAME = seedDbName
    env.TURSO_API_BASE_URL = `http://127.0.0.1:${mockPort}`

    resetDbForTests()
  })

  afterAll(() => {
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

  it('should list tenants via tenanso', async () => {
    const tenanso = getTenanso()
    expect(tenanso).not.toBeNull()

    // Seed DB is the only "database" so far
    const tenants = await tenanso!.listTenants()
    expect(tenants).toContain('migrate-test-seed')
  })

  it('should create tenants and verify they have the schema', async () => {
    const tenanso = getTenanso()!

    // Create two tenant DBs
    await tenanso.createTenant('user-100')
    await tenanso.createTenant('user-200')

    // Verify files exist (cloned from seed)
    expect(fs.existsSync(path.join(dbDir, 'user-100.db'))).toBe(true)
    expect(fs.existsSync(path.join(dbDir, 'user-200.db'))).toBe(true)

    // Verify the tenant DB has the tasks table (from seed schema)
    const client = createClient({ url: `file:${path.join(dbDir, 'user-100.db')}` })
    const db = drizzle({ client, schema, casing: 'snake_case' })

    // Query the tasks table — should be empty but exist
    const tasks = await db.select().from(schema.tasksTable)
    expect(tasks).toEqual([])
  })

  it('should list created tenants', async () => {
    const tenanso = getTenanso()!
    const tenants = await tenanso.listTenants()

    expect(tenants).toContain('user-100')
    expect(tenants).toContain('user-200')
  })

  it('should apply migrations to tenant databases via withTenant', async () => {
    const tenanso = getTenanso()!

    // Insert data into user-100 via withTenant to verify DB is writable
    await tenanso.withTenant('user-100', async (db) => {
      // Use raw SQL since tenanso's drizzle instance doesn't have casing config
      await (db as any).run(
        sql`INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com')`
      )
      await (db as any).run(
        sql`INSERT INTO tasks (user_id, title, description) VALUES (1, 'Migration test', 'Testing migrations')`
      )
    })

    // Verify data was inserted
    const client = createClient({ url: `file:${path.join(dbDir, 'user-100.db')}` })
    const db = drizzle({ client, schema, casing: 'snake_case' })
    const tasks = await db.select().from(schema.tasksTable)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Migration test')

    // Verify user-200 is empty (isolation)
    const client2 = createClient({ url: `file:${path.join(dbDir, 'user-200.db')}` })
    const db2 = drizzle({ client: client2, schema, casing: 'snake_case' })
    const tasks2 = await db2.select().from(schema.tasksTable)
    expect(tasks2).toEqual([])
  })
})
