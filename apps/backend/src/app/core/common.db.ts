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
 * Returns null when tenanso env vars are not configured (local dev).
 */
export function getTenanso(): TenansoInstance | null {
  const env = getEnv()
  if (tenansoInstance) return tenansoInstance

  const orgSlug = env.TURSO_ORG_SLUG
  const apiToken = env.TURSO_API_TOKEN
  const group = env.TURSO_GROUP
  const groupAuthToken = env.TURSO_GROUP_AUTH_TOKEN
  const tenantDbUrl = env.TURSO_TENANT_DB_URL
  const seedDbName = env.TURSO_SEED_DB_NAME

  if (!orgSlug || !apiToken || !group || !groupAuthToken || !tenantDbUrl || !seedDbName) {
    return null
  }

  const tursoApiBaseUrl = env.TURSO_API_BASE_URL

  tenansoInstance = createTenanso({
    turso: {
      organizationSlug: orgSlug,
      apiToken,
      group,
      ...(tursoApiBaseUrl ? { baseUrl: tursoApiBaseUrl } : {}),
    },
    databaseUrl: tenantDbUrl,
    authToken: groupAuthToken,
    schema,
    drizzleOptions: { casing: 'snake_case' },
    seed: { database: seedDbName },
  })

  return tenansoInstance
}

/**
 * Returns the tenant database for a specific user.
 * In production (tenanso configured): returns a per-user database.
 * In local dev (tenanso not configured): falls back to getMainDb() (single DB mode).
 */
export function getTenantDbForUser(userId: number): DB {
  const tenanso = getTenanso()
  if (!tenanso) {
    return getMainDb()
  }
  return tenanso.dbFor(tenantNameForUser(userId)) as unknown as DB
}

/** Derive tenant database name from user ID: {group}-user-{id} */
export function tenantNameForUser(userId: number): string {
  const group = getEnv().TURSO_GROUP || 'default'
  return `${group}-user-${userId}`
}

/**
 * Creates the tenant DB for a user and seeds the user record.
 * No-op in local dev (single DB mode). Throws on failure.
 */
export async function provisionTenant(user: { id: number; name: string; email: string }): Promise<void> {
  const tenanso = getTenanso()
  if (!tenanso) return // Local dev — single DB mode

  const tenantName = tenantNameForUser(user.id)
  await tenanso.createTenant(tenantName)

  // Seed the user record into the tenant DB so FK constraints are satisfied.
  // Turso has a short propagation delay after database creation, so we retry.
  const tenantDb = getTenantDbForUser(user.id)
  const maxRetries = 5
  const delayMs = 1000
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await tenantDb
        .insert(schema.usersTable)
        .values({ id: user.id, name: user.name, email: user.email })
        .onConflictDoNothing()
      return
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to seed tenant DB after ${maxRetries} attempts`, { cause: error })
      }
      console.log(`Tenant DB not ready yet (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Validates that the user's tenant DB is provisioned and ready.
 * Returns Ok() on success, Err(reason) on failure.
 * In local dev (single DB mode), always returns Ok().
 */
export async function validateUserReady(userId: number): Promise<Result> {
  const tenanso = getTenanso()
  if (!tenanso) return Ok()

  try {
    const exists = await tenanso.tenantExists(tenantNameForUser(userId))
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
