import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { createTenanso, type TenansoInstance } from 'tenanso'
import * as schema from '../db/schema/schema'
import { getMainDb, resetMainDbForTests } from './internal/main-db'
import { getEnv } from './env'
import { type Result, Ok, Err } from './types'

// Re-export so existing callers of common.db.getMainDb still compile,
// but new code should prefer the user-scoped OAuthService or tenant DB.
export { getMainDb }

/** @deprecated Use getTenantDbForUser() or OAuthService instead */
export function getDb(): DB {
  return getMainDb()
}

let tenansoInstance: TenansoInstance | null = null

/**
 * Returns the tenanso instance for multi-tenant database management.
 */
export function getTenanso(): TenansoInstance {
  if (tenansoInstance) return tenansoInstance

  const env = getEnv()
  const tursoApiBaseUrl = env.TURSO_API_BASE_URL
  // Compute the tenant DB URL from orgSlug, or use override (for tests with file: URLs)
  const tenantDbUrl = env.TURSO_TENANT_DB_URL || `libsql://{tenant}-${env.TURSO_ORG_SLUG}.turso.io`

  tenansoInstance = createTenanso({
    turso: {
      organizationSlug: env.TURSO_ORG_SLUG,
      apiToken: env.TURSO_API_TOKEN,
      group: env.TURSO_GROUP,
      ...(tursoApiBaseUrl ? { baseUrl: tursoApiBaseUrl } : {}),
    },
    databaseUrl: tenantDbUrl,
    authToken: env.TURSO_GROUP_AUTH_TOKEN,
    schema,
    drizzleOptions: { casing: 'snake_case' },
    seed: { database: env.TURSO_SEED_DB_NAME },
  })

  return tenansoInstance
}

/**
 * Returns the tenant database for a specific user.
 */
export function getTenantDbForUser(userId: number): DB {
  return getTenanso().dbFor(tenantNameForUser(userId)) as unknown as DB
}

/** Derive tenant database name: {group}-user-{id} */
export function tenantNameForUser(userId: number): string {
  const group = getEnv().TURSO_GROUP || 'default'
  return `${group}-user-${userId}`
}

const TENANT_DB_READY_TIMEOUT_MS = 30_000
const TENANT_DB_RETRY_BASE_MS = 500

/** Turso returns 404/503 until a newly cloned tenant DB is ready for queries. */
function isTenantDbNotReadyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = (error as Error & { cause?: { httpStatus?: number; message?: string } }).cause
  if (cause?.httpStatus === 404 || cause?.httpStatus === 503) return true
  const message = `${error.message} ${cause?.message ?? ''}`
  return message.includes('404') || message.includes('503') || message.includes('SERVER_ERROR')
}

async function seedTenantUser(
  tenantDb: DB,
  user: { id: number; name: string; email: string }
): Promise<void> {
  const deadline = Date.now() + TENANT_DB_READY_TIMEOUT_MS
  let attempt = 0

  while (Date.now() < deadline) {
    attempt++
    try {
      await tenantDb
        .insert(schema.usersTable)
        .values({ id: user.id, name: user.name, email: user.email })
        .onConflictDoNothing()
      return
    } catch (error) {
      if (!isTenantDbNotReadyError(error) || Date.now() >= deadline) throw error
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(TENANT_DB_RETRY_BASE_MS * attempt, 2_000))
      )
    }
  }

  throw new Error(`Tenant database not ready after ${attempt} attempts`)
}

/**
 * Creates the tenant DB for a user and seeds the user record.
 * Throws on failure.
 *
 * Turso may return 404/503 for a few seconds after cloning from the seed DB;
 * seedTenantUser retries until the tenant accepts writes.
 */
export async function provisionTenant(user: { id: number; name: string; email: string }): Promise<void> {
  const tenantName = tenantNameForUser(user.id)

  try {
    await getTenanso().createTenant(tenantName)
  } catch (error) {
    // Tenant may already exist from a prior partial provisioning attempt.
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('already exists') && !message.includes('409')) throw error
  }

  // Seed the user record into the tenant DB so FK constraints are satisfied.
  await seedTenantUser(getTenantDbForUser(user.id), user)
}

/**
 * Validates that the user's tenant DB is provisioned and ready.
 * Returns Ok() on success, Err(reason) on failure.
 * Returns Ok() when the tenant DB exists.
 */
export async function validateUserReady(userId: number): Promise<Result> {
  try {
    const exists = await getTenanso().tenantExists(tenantNameForUser(userId))
    if (!exists) {
      return Err(`Tenant database for user ${userId} does not exist`)
    }
    return Ok()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return Err(`Failed to check tenant database for user ${userId}: ${reason}`)
  }
}

export const resetDbForTests = () => {
  resetMainDbForTests()
  tenansoInstance = null
}

export type DB = BaseSQLiteDatabase<'async', unknown, typeof schema>
