import { eq, and, lt } from 'drizzle-orm'
import { oauthSessionsTable, type SelectOAuthSession } from '../db/schema/schema'
import { createId, type DB } from './common.db'
import { getCurrentUnixTimestamp } from './common.core'

// Session TTL: 10 minutes
const SESSION_TTL_SECONDS = 10 * 60

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i]! % chars.length]
  }
  return result
}

/**
 * Generate SHA256 hash and base64url encode for PKCE code_challenge
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hashBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface OAuthSessionData {
  sessionId: string
  state: string
  codeChallenge: string
  redirectUri: string
}

/**
 * Create a new OAuth session with PKCE values
 */
export async function createOAuthSession(
  db: DB,
  redirectUri: string
): Promise<OAuthSessionData> {
  const sessionId = createId()
  const state = generateRandomString(32)
  const codeVerifier = generateRandomString(64)
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const now = getCurrentUnixTimestamp()
  const expiresAt = now + SESSION_TTL_SECONDS

  await db.insert(oauthSessionsTable).values({
    id: sessionId,
    state,
    codeVerifier,
    redirectUri,
    expiresAt,
    createdAt: now,
  })

  return {
    sessionId,
    state,
    codeChallenge,
    redirectUri,
  }
}

/**
 * Get and validate an OAuth session
 * Returns null if session not found, expired, or state mismatch
 */
export async function getValidOAuthSession(
  db: DB,
  sessionId: string,
  state: string
): Promise<SelectOAuthSession | null> {
  const now = getCurrentUnixTimestamp()

  const [session] = await db
    .select()
    .from(oauthSessionsTable)
    .where(
      and(
        eq(oauthSessionsTable.id, sessionId),
        eq(oauthSessionsTable.state, state)
      )
    )
    .limit(1)

  if (!session) {
    return null
  }

  // Check if expired
  if (session.expiresAt < now) {
    // Clean up expired session
    await db.delete(oauthSessionsTable).where(eq(oauthSessionsTable.id, sessionId))
    return null
  }

  return session
}

/**
 * Delete an OAuth session after successful token exchange
 */
export async function deleteOAuthSession(db: DB, sessionId: string): Promise<void> {
  await db.delete(oauthSessionsTable).where(eq(oauthSessionsTable.id, sessionId))
}

/**
 * Clean up expired OAuth sessions (housekeeping)
 * Can be called periodically or on each request
 */
export async function cleanupExpiredSessions(db: DB): Promise<number> {
  const now = getCurrentUnixTimestamp()
  const result = await db
    .delete(oauthSessionsTable)
    .where(lt(oauthSessionsTable.expiresAt, now))
    .returning()
  return result.length
}
