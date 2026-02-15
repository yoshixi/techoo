import type { D1Database } from '@cloudflare/workers-types'
import * as schema from '../schema/schema'
import { type DB } from '../../core/common.db'
import { createSqliteLibsqlTestContext } from './sqliteLibsqlTestUtils'

export type D1TestContext = {
  db: DB
  d1?: D1Database
  reset: () => Promise<void>
  stop: () => Promise<void>
}

type RequestInput = RequestInfo | URL
type TestResponse = Response & { json: () => Promise<any> }

export async function createTestUser(db: DB, name = 'Test User', email = 'test@example.com') {
  const [user] = await db.insert(schema.usersTable).values({ name, email }).returning()
  return user!
}

export const createTestRequest = (context: D1TestContext) => {
  return (app: { request: (...args: any[]) => Response | Promise<Response> }) => {
    return async (input: RequestInput, init?: RequestInit): Promise<TestResponse> => {
      const env = context.d1 ? { DB: context.d1 } : {}
      const response = await app.request(input, init, env)
      return response as TestResponse
    }
  }
}

export async function createD1TestContext(): Promise<D1TestContext> {
  const sqliteContext = await createSqliteLibsqlTestContext()
  return {
    db: sqliteContext.db,
    reset: sqliteContext.reset,
    stop: async () => {
      sqliteContext.stop()
    },
  }
}
