import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { createTenanso, type TenansoInstance } from 'tenanso'
import * as schema from '../db/schema/schema'
import { getMainDb, resetMainDbForTests } from './internal/main-db'
import { getEnv } from './env'

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
  const seedDbUrl = env.TURSO_SEED_DB_URL

  if (!orgSlug || !apiToken || !group || !groupAuthToken || !tenantDbUrl || !seedDbUrl) {
    return null
  }

  // Extract DB name from URL for tenanso's seed config.
  // libsql://{db-name}-{org}.turso.io → db-name-org
  // file:/path/to/seed.db → seed
  const seedDbName = seedDbUrl.startsWith('file:')
    ? seedDbUrl.replace(/^file:.*\//, '').replace(/\.db$/, '')
    : new URL(seedDbUrl).hostname.replace(/\.turso\.io$/, '')

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
  return tenanso.dbFor(`user-${userId}`) as unknown as DB
}

/** Helper to derive tenant name from user ID */
export function tenantNameForUser(userId: number): string {
  return `user-${userId}`
}

/**
 * Returns true if the user's tenant DB is provisioned and ready.
 * In local dev (single DB mode), always returns true.
 */
export async function isUserReady(userId: number): Promise<boolean> {
  const tenanso = getTenanso()
  if (!tenanso) return true
  return tenanso.tenantExists(tenantNameForUser(userId))
}

export const resetDbForTests = () => {
  resetMainDbForTests()
  tenansoInstance = null
}

export type DB = BaseSQLiteDatabase<'async', unknown, typeof schema>
