import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { listGoogleAccountsRoute } from '../routes/google-auth'
import { listGoogleAccountsHandler } from './google-auth'
import {
  createSqliteLibsqlTestContext,
  createTestRequest,
  createTestUser,
  type SqliteLibsqlTestContext
} from '../../../db/tests/sqliteLibsqlTestUtils'
import { accountsTable } from '../../../db/schema/schema'
import pino from 'pino'
import type { DB } from '../../../core/common.db'
import { createOAuthService } from '../../../core/oauth.service'

type TestUser = { id: number; email: string; name: string }

const createTestApp = (getUser: () => TestUser | null, getDb: () => DB) => {
  const app = new OpenAPIHono<AppBindings>()

  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'test-request-id')
    const user = getUser()
    if (user) {
      c.set('user', user)
      c.set('db', getDb())
      c.set('oauth', createOAuthService(user.id, getDb()))
    }
    await next()
  })

  app.openapi(listGoogleAccountsRoute, listGoogleAccountsHandler)

  return app
}

describe('Google Auth Handlers', () => {
  let testContext: SqliteLibsqlTestContext
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  let testUser: TestUser | null = null
  let otherUser: TestUser | null = null

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
    app = createTestApp(() => testUser, () => testContext.db)
    request = createTestRequest(testContext)(app)
  })

  beforeEach(async () => {
    await testContext.reset()
    const user = await createTestUser(testContext.db, 'User A', 'user-a@example.com')
    const userB = await createTestUser(testContext.db, 'User B', 'user-b@example.com')
    testUser = { id: user.id, email: user.email, name: user.name }
    otherUser = { id: userB.id, email: userB.email, name: userB.name }

    await testContext.db.insert(accountsTable).values([
      {
        userId: testUser.id,
        providerId: 'google',
        accountId: 'acct-a',
        providerEmail: 'user-a@gmail.com'
      },
      {
        userId: testUser.id,
        providerId: 'google',
        accountId: 'acct-a-2'
      },
      {
        userId: otherUser.id,
        providerId: 'google',
        accountId: 'acct-b',
        providerEmail: 'user-b@gmail.com'
      }
    ])
  })

  afterAll(async () => {
    if (testContext) {
      await testContext.reset()
      await testContext.stop()
    }
  })

  it('returns linked Google accounts with stored email', async () => {
    const res = await request(new Request('http://localhost/oauth/google/accounts'))

    expect(res.status).toBe(200)
    const data = await res.json()

    expect(Array.isArray(data.accounts)).toBe(true)
    expect(data.accounts).toHaveLength(2)

    const accountA = data.accounts.find((account: { accountId: string }) => account.accountId === 'acct-a')
    const accountA2 = data.accounts.find((account: { accountId: string }) => account.accountId === 'acct-a-2')

    expect(accountA?.email).toBe('user-a@gmail.com')
    expect(accountA2?.email).toBeUndefined()
  })
})
