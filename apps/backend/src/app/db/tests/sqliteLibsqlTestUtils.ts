import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { pushSQLiteSchema } from 'drizzle-kit/api'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as schema from '../schema/schema'
import { resetDbForTests, type DB } from '../../core/common.db'

export type SqliteLibsqlTestContext = {
  db: DB
  reset: () => Promise<void>
  stop: () => void
}

type RequestInput = RequestInfo | URL
type TestResponse = Response & { json: () => Promise<any> }

/**
 * Creates a test user with email (required after auth schema migration).
 * Returns the created user row.
 */
export async function createTestUser(db: DB, name = 'Test User', email = 'test@example.com') {
  const [user] = await db.insert(schema.usersTable).values({ name, email }).returning()
  return user!
}

export const createTestRequest = (context: SqliteLibsqlTestContext) => {
  return (app: { request: (...args: any[]) => Response | Promise<Response> }) => {
    return async (input: RequestInput, init?: RequestInit): Promise<TestResponse> => {
      const response = await app.request(input, init, {})
      return response as TestResponse
    }
  }
}

const IN_MEMORY_URL = 'file::memory:?cache=shared'

const ensureDirectoryForUrl = (url: string) => {
  if (!url.startsWith('file:')) return
  if (url.startsWith('file::memory')) return

  const filePath = url.replace(/^file:/, '')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

const getTestDB = (url: string): ReturnType<typeof drizzle> => {
  ensureDirectoryForUrl(url)
  const client = createClient({ url })
  return drizzle({
    client,
    schema,
    casing: 'snake_case',
  })
}

const migrateDB = async (db: ReturnType<typeof getTestDB>) => {
  const { apply } = await pushSQLiteSchema(schema, db)
  await apply()
}

export async function createSqliteLibsqlTestContext(): Promise<SqliteLibsqlTestContext> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shuchu-d1-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const url = `file:${dbPath}`

  const prevUrl = process.env.SQLITE_URL

  process.env.SQLITE_URL = url
  resetDbForTests()

  const db = getTestDB(url)
  await migrateDB(db)

  const reset = async () => {
    await db.delete(schema.taskTagsTable)
    await db.delete(schema.taskTimersTable)
    await db.delete(schema.taskCommentsTable)
    await db.delete(schema.tasksTable)
    await db.delete(schema.tagsTable)
    await db.delete(schema.verificationsTable)
    await db.delete(schema.accountsTable)
    await db.delete(schema.sessionsTable)
    await db.delete(schema.usersTable)
  }

  return {
    db: db as unknown as DB,
    reset,
    stop: () => {
      if (prevUrl === undefined) {
        delete process.env.SQLITE_URL
      } else {
        process.env.SQLITE_URL = prevUrl
      }
      resetDbForTests()
    },
  }
}
