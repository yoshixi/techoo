/**
 * Short-lived exchange codes for OAuth redirects.
 *
 * Wraps getMainDb() so that route.ts no longer needs direct access.
 */
import { eq } from 'drizzle-orm'
import { getMainDb } from './internal/main-db'
import { oauthExchangeCodesTable } from '../db/schema/schema'
import { protectSensitiveValue, readPossiblyProtectedValue } from './data-protection'

const EXCHANGE_CODE_TTL_MS = 5 * 60 * 1000

const hashExchangeCode = async (code: string): Promise<string> => {
  const data = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function createExchangeCode(
  sessionToken: string
): Promise<string> {
  const code = crypto.randomUUID()
  const codeHash = await hashExchangeCode(code)
  const expiresAt = new Date(Date.now() + EXCHANGE_CODE_TTL_MS)
  const protectedSessionToken = await protectSensitiveValue(sessionToken)
  const db = getMainDb()
  await db.insert(oauthExchangeCodesTable).values({
    codeHash,
    sessionToken: protectedSessionToken,
    expiresAt,
  })
  return code
}

export async function consumeExchangeCode(
  code: string
): Promise<string | null> {
  const codeHash = await hashExchangeCode(code)
  const db = getMainDb()
  const rows = await db
    .select()
    .from(oauthExchangeCodesTable)
    .where(eq(oauthExchangeCodesTable.codeHash, codeHash))
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db
      .delete(oauthExchangeCodesTable)
      .where(eq(oauthExchangeCodesTable.id, row.id))
    return null
  }
  await db
    .delete(oauthExchangeCodesTable)
    .where(eq(oauthExchangeCodesTable.id, row.id))
  return readPossiblyProtectedValue(row.sessionToken)
}
