import { eq, and } from 'drizzle-orm'
import { oauthTokensTable, type InsertOauthToken, type SelectOauthToken } from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, getCurrentUnixTimestamp } from './common.core'
import type { ProviderType, OAuthToken } from './oauth.core'

// Internal types for token data
export interface CreateOAuthToken {
  userId: number
  providerType: ProviderType
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp
  scope: string
}

export interface UpdateOAuthToken {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number // Unix timestamp
  scope?: string
}

// Convert database token to API token (without exposing sensitive data)
export function convertDbTokenToApi(dbToken: SelectOauthToken): OAuthToken {
  return {
    id: dbToken.id.toString(),
    userId: dbToken.userId.toString(),
    providerType: dbToken.providerType as ProviderType,
    expiresAt: formatTimestamp(dbToken.expiresAt),
    scope: dbToken.scope,
    createdAt: formatTimestamp(dbToken.createdAt),
    updatedAt: formatTimestamp(dbToken.updatedAt)
  }
}

// Get OAuth token by user ID and provider type
export async function getOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<SelectOauthToken | null> {
  const [token] = await db
    .select()
    .from(oauthTokensTable)
    .where(
      and(
        eq(oauthTokensTable.userId, userId),
        eq(oauthTokensTable.providerType, providerType)
      )
    )
  return token || null
}

// Check if user has a valid (non-expired) token
export async function hasValidOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<boolean> {
  const token = await getOAuthToken(db, userId, providerType)
  if (!token) return false

  const now = getCurrentUnixTimestamp()
  return token.expiresAt > now
}

// Upsert OAuth token (create or update)
export async function upsertOAuthToken(
  db: DB,
  data: CreateOAuthToken
): Promise<SelectOauthToken> {
  const now = getCurrentUnixTimestamp()

  // Check if token already exists
  const existingToken = await getOAuthToken(db, data.userId, data.providerType)

  if (existingToken) {
    // Update existing token
    const [updatedToken] = await db
      .update(oauthTokensTable)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        scope: data.scope,
        updatedAt: now
      })
      .where(eq(oauthTokensTable.id, existingToken.id))
      .returning()

    if (!updatedToken) {
      throw new Error('Failed to update OAuth token')
    }
    return updatedToken
  }

  // Create new token (id is auto-incremented)
  const tokenData: Omit<InsertOauthToken, 'id'> = {
    userId: data.userId,
    providerType: data.providerType,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    scope: data.scope,
    createdAt: now,
    updatedAt: now
  }

  const [newToken] = await db
    .insert(oauthTokensTable)
    .values(tokenData)
    .returning()

  if (!newToken) {
    throw new Error('Failed to create OAuth token')
  }
  return newToken
}

// Update OAuth token (for token refresh)
export async function updateOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType,
  data: UpdateOAuthToken
): Promise<SelectOauthToken | null> {
  const existingToken = await getOAuthToken(db, userId, providerType)
  if (!existingToken) return null

  const now = getCurrentUnixTimestamp()
  const updateData: Partial<InsertOauthToken> = {
    updatedAt: now
  }

  if (data.accessToken !== undefined) updateData.accessToken = data.accessToken
  if (data.refreshToken !== undefined) updateData.refreshToken = data.refreshToken
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt
  if (data.scope !== undefined) updateData.scope = data.scope

  const [updatedToken] = await db
    .update(oauthTokensTable)
    .set(updateData)
    .where(eq(oauthTokensTable.id, existingToken.id))
    .returning()

  return updatedToken || null
}

// Delete OAuth token
export async function deleteOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<SelectOauthToken | null> {
  const existingToken = await getOAuthToken(db, userId, providerType)
  if (!existingToken) return null

  const [deletedToken] = await db
    .delete(oauthTokensTable)
    .where(eq(oauthTokensTable.id, existingToken.id))
    .returning()

  return deletedToken || null
}
