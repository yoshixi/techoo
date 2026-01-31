import { eq, and } from 'drizzle-orm'
import { usersTable, userAuthProvidersTable, type SelectUser } from '../db/schema/schema'
import { createId, type DB } from './common.db'
import { getCurrentUnixTimestamp } from './common.core'

export interface AuthProviderInfo {
  provider: string       // 'clerk', 'google', etc.
  providerId: string     // External ID from provider
  email?: string         // Email from provider
  name?: string          // Display name from provider
  imageUrl?: string      // Profile image URL
}

// In-memory cache for user lookups (TTL: 5 minutes)
// Key: `${provider}:${providerId}`
const userCache = new Map<string, { user: SelectUser; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getCacheKey(provider: string, providerId: string): string {
  return `${provider}:${providerId}`
}

/**
 * Find or create a user by their auth provider credentials.
 *
 * This function:
 * 1. Checks in-memory cache first
 * 2. Looks up the user_auth_providers table by (provider, providerId)
 * 3. If found, returns the linked user (optionally updating provider data)
 * 4. If not found, creates a new user and auth provider record
 *
 * Handles race conditions when multiple requests try to create the same user.
 *
 * @param db - Database instance
 * @param providerInfo - Authentication provider information
 * @returns The user record
 */
export async function findOrCreateUserByProvider(
  db: DB,
  providerInfo: AuthProviderInfo
): Promise<SelectUser> {
  const { provider, providerId, email, name, imageUrl } = providerInfo
  const cacheKey = getCacheKey(provider, providerId)
  const now = Date.now()

  // Check cache first
  const cached = userCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.user
  }

  // First, try to find existing auth provider record
  const existingAuthProvider = await db
    .select({
      authProvider: userAuthProvidersTable,
      user: usersTable
    })
    .from(userAuthProvidersTable)
    .innerJoin(usersTable, eq(userAuthProvidersTable.userId, usersTable.id))
    .where(
      and(
        eq(userAuthProvidersTable.provider, provider),
        eq(userAuthProvidersTable.providerId, providerId)
      )
    )
    .limit(1)

  if (existingAuthProvider.length > 0) {
    const record = existingAuthProvider[0]!
    const { authProvider, user } = record

    // Update provider data if it has changed
    const providerData = imageUrl ? JSON.stringify({ imageUrl }) : null
    const shouldUpdate =
      authProvider.email !== email ||
      authProvider.providerData !== providerData

    if (shouldUpdate) {
      const timestamp = getCurrentUnixTimestamp()
      await db
        .update(userAuthProvidersTable)
        .set({
          email,
          providerData,
          updatedAt: timestamp
        })
        .where(eq(userAuthProvidersTable.id, authProvider.id))
    }

    // Update user name if provided and different
    let resultUser = user
    if (name && user.name !== name) {
      const timestamp = getCurrentUnixTimestamp()
      await db
        .update(usersTable)
        .set({ name, updatedAt: timestamp })
        .where(eq(usersTable.id, user.id))

      resultUser = { ...user, name }
    }

    // Cache the result
    userCache.set(cacheKey, { user: resultUser, expiresAt: now + CACHE_TTL_MS })
    return resultUser
  }

  // No existing auth provider - create new user and link auth provider
  const timestamp = getCurrentUnixTimestamp()
  const userId = createId()
  const authProviderId = createId()

  try {
    // Create user
    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: userId,
        name: name || email || 'User',
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .returning()

    if (!newUser) {
      throw new Error('Failed to create user')
    }

    // Create auth provider link
    const providerData = imageUrl ? JSON.stringify({ imageUrl }) : null
    await db.insert(userAuthProvidersTable).values({
      id: authProviderId,
      userId: userId,
      provider,
      providerId,
      email,
      providerData,
      createdAt: timestamp,
      updatedAt: timestamp
    })

    // Cache the result
    userCache.set(cacheKey, { user: newUser, expiresAt: now + CACHE_TTL_MS })
    return newUser
  } catch (error) {
    // Handle race condition: another request may have created the identity
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      // Retry the lookup
      const [raceResult] = await db
        .select({
          authProvider: userAuthProvidersTable,
          user: usersTable
        })
        .from(userAuthProvidersTable)
        .innerJoin(usersTable, eq(userAuthProvidersTable.userId, usersTable.id))
        .where(
          and(
            eq(userAuthProvidersTable.provider, provider),
            eq(userAuthProvidersTable.providerId, providerId)
          )
        )
        .limit(1)

      if (raceResult) {
        userCache.set(cacheKey, { user: raceResult.user, expiresAt: now + CACHE_TTL_MS })
        return raceResult.user
      }
    }
    throw error
  }
}

/**
 * Invalidate the user cache for a specific provider/providerId.
 * Call this when user data is modified outside of findOrCreateUserByProvider.
 */
export function invalidateUserCache(provider: string, providerId: string): void {
  userCache.delete(getCacheKey(provider, providerId))
}

/**
 * Get user by auth provider credentials.
 * Returns null if no matching user is found.
 */
export async function getUserByProvider(
  db: DB,
  provider: string,
  providerId: string
): Promise<SelectUser | null> {
  const result = await db
    .select({ user: usersTable })
    .from(userAuthProvidersTable)
    .innerJoin(usersTable, eq(userAuthProvidersTable.userId, usersTable.id))
    .where(
      and(
        eq(userAuthProvidersTable.provider, provider),
        eq(userAuthProvidersTable.providerId, providerId)
      )
    )
    .limit(1)

  return result.length > 0 ? result[0]!.user : null
}

/**
 * Link an additional auth provider to an existing user.
 */
export async function linkAuthProvider(
  db: DB,
  userId: string,
  providerInfo: AuthProviderInfo
): Promise<void> {
  const { provider, providerId, email, imageUrl } = providerInfo
  const now = getCurrentUnixTimestamp()
  const providerData = imageUrl ? JSON.stringify({ imageUrl }) : null

  await db.insert(userAuthProvidersTable).values({
    id: createId(),
    userId,
    provider,
    providerId,
    email,
    providerData,
    createdAt: now,
    updatedAt: now
  })
}

/**
 * Remove an auth provider link from a user.
 */
export async function unlinkAuthProvider(
  db: DB,
  userId: string,
  provider: string,
  providerId: string
): Promise<boolean> {
  const result = await db
    .delete(userAuthProvidersTable)
    .where(
      and(
        eq(userAuthProvidersTable.userId, userId),
        eq(userAuthProvidersTable.provider, provider),
        eq(userAuthProvidersTable.providerId, providerId)
      )
    )
    .returning()

  return result.length > 0
}

/**
 * Get all auth providers linked to a user.
 */
export async function getUserAuthProviders(db: DB, userId: string) {
  return db
    .select()
    .from(userAuthProvidersTable)
    .where(eq(userAuthProvidersTable.userId, userId))
}
