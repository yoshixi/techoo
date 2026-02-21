import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { createAuth } from './auth'
import { googleCalendarProvider } from './calendar-providers/google.service'
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../db/tests/sqliteLibsqlTestUtils'
import { usersTable, accountsTable } from '../db/schema/schema'
import { eq } from 'drizzle-orm'

describe('Auth database hooks', () => {
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-at-least-32-chars-long'
    process.env.BETTER_AUTH_URL = 'http://localhost:8787'
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:8787/api/auth/callback/google'
  })

  let testContext: SqliteLibsqlTestContext

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await testContext.reset()
  })

  afterAll(() => {
    testContext.stop()
  })

  it('persists providerEmail when account is created via internal adapter', async () => {
    const auth = createAuth() as unknown as {
      $context: Promise<{
        internalAdapter: {
          createAccount: (data: Record<string, unknown>) => Promise<void>
        }
      }>
    }
    const ctx = await auth.$context

    const [user] = await testContext.db
      .insert(usersTable)
      .values({ name: 'Hook User', email: 'hook-user@example.com' })
      .returning()

    const getUserInfoSpy = vi
      .spyOn(googleCalendarProvider, 'getUserInfo')
      .mockResolvedValue({ email: 'linked@example.com' })

    await ctx.internalAdapter.createAccount({
      userId: String(user.id),
      providerId: 'google',
      accountId: 'google-account-1',
      accessToken: 'access-token'
    })

    const [account] = await testContext.db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.accountId, 'google-account-1'))

    expect(getUserInfoSpy).toHaveBeenCalledTimes(1)
    expect(account?.providerEmail).toBe('linked@example.com')
  })

  it('skips providerEmail lookup for non-Google accounts', async () => {
    const auth = createAuth() as unknown as { $context: Promise<{ options: any }> }
    const ctx = await auth.$context
    const hook = ctx.options.databaseHooks?.account?.create?.after

    const getUserInfoSpy = vi.spyOn(googleCalendarProvider, 'getUserInfo')

    const result = await hook({
      providerId: 'github',
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date()
    })

    expect(getUserInfoSpy).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('skips providerEmail lookup when access token is missing', async () => {
    const auth = createAuth() as unknown as { $context: Promise<{ options: any }> }
    const ctx = await auth.$context
    const hook = ctx.options.databaseHooks?.account?.create?.after

    const getUserInfoSpy = vi.spyOn(googleCalendarProvider, 'getUserInfo')

    const result = await hook({
      providerId: 'google',
      accessToken: null,
      accessTokenExpiresAt: new Date()
    })

    expect(getUserInfoSpy).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
