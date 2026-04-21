import { eq, and } from 'drizzle-orm'
import { accountsTable, type SelectAccount } from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, getCurrentTimestamp } from './common.core'
import type { ProviderType, OAuthToken, OAuthAccount } from './oauth.core'
import { protectSensitiveValue, readPossiblyProtectedValue } from './data-protection'

// Internal types for token data (compatible with accounts table)
export interface OAuthTokenData {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  scope: string | null
}

export interface UpdateOAuthToken {
  accessToken?: string
  refreshToken?: string | null
  expiresAt?: Date
}

async function decryptAccountTokens(account: SelectAccount): Promise<SelectAccount> {
  return {
    ...account,
    accessToken: account.accessToken
      ? await readPossiblyProtectedValue(account.accessToken)
      : account.accessToken,
    refreshToken: account.refreshToken
      ? await readPossiblyProtectedValue(account.refreshToken)
      : account.refreshToken,
    idToken: account.idToken
      ? await readPossiblyProtectedValue(account.idToken)
      : account.idToken
  }
}

// Convert account record to API token format
export function convertAccountToApiToken(account: SelectAccount): OAuthToken {
  return {
    id: account.id.toString(),
    userId: account.userId.toString(),
    providerType: account.providerId as ProviderType,
    expiresAt: account.accessTokenExpiresAt
      ? formatTimestamp(account.accessTokenExpiresAt)
      : null,
    scope: account.scope || '',
    createdAt: formatTimestamp(account.createdAt),
    updatedAt: formatTimestamp(account.updatedAt)
  }
}

export function convertAccountToApiAccount(account: SelectAccount): OAuthAccount {
  return {
    id: account.id.toString(),
    userId: account.userId.toString(),
    providerType: account.providerId as ProviderType,
    accountId: account.accountId,
    email: account.providerEmail || undefined,
    createdAt: formatTimestamp(account.createdAt),
    updatedAt: formatTimestamp(account.updatedAt)
  }
}

// Get OAuth token from accounts table by user ID, provider, and account ID
// This retrieves tokens stored by better-auth during social login
export async function getOAuthTokenForAccount(
  db: DB,
  userId: number,
  providerType: ProviderType,
  accountId: string
): Promise<SelectAccount | null> {
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.providerId, providerType),
        eq(accountsTable.accountId, accountId)
      )
    )
  return account ? decryptAccountTokens(account) : null
}

// List linked OAuth accounts for a provider
export async function listOAuthAccounts(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<OAuthAccount[]> {
  const accounts = await listOAuthAccountRecords(db, userId, providerType)
  return accounts.map(convertAccountToApiAccount)
}

export async function listOAuthAccountRecords(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<SelectAccount[]> {
  return db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.userId, userId),
        eq(accountsTable.providerId, providerType)
      )
    )
}


// Check if user has a valid (non-expired) token
export async function hasValidOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType,
  accountId: string
): Promise<boolean> {
  const account = await getOAuthTokenForAccount(
    db,
    userId,
    providerType,
    accountId
  )
  if (!account || !account.accessToken) return false

  // If no expiry is set, assume token is valid
  if (!account.accessTokenExpiresAt) return true

  const now = getCurrentTimestamp()
  return account.accessTokenExpiresAt > now
}

// Update OAuth token in accounts table (for token refresh)
// Note: Accounts are created by better-auth during social login,
// so we only update tokens here, not create new accounts
export async function updateOAuthToken(
  db: DB,
  userId: number,
  providerType: ProviderType,
  accountId: string,
  data: UpdateOAuthToken
): Promise<SelectAccount | null> {
  const existingAccount = await getOAuthTokenForAccount(
    db,
    userId,
    providerType,
    accountId
  )
  if (!existingAccount) return null

  const now = getCurrentTimestamp()
  const updateData: Partial<SelectAccount> = {
    updatedAt: now
  }

  if (data.accessToken !== undefined) {
    updateData.accessToken = await protectSensitiveValue(data.accessToken)
  }
  if (data.refreshToken !== undefined) {
    updateData.refreshToken = data.refreshToken
      ? await protectSensitiveValue(data.refreshToken)
      : data.refreshToken
  }
  if (data.expiresAt !== undefined) updateData.accessTokenExpiresAt = data.expiresAt

  const [updatedAccount] = await db
    .update(accountsTable)
    .set(updateData)
    .where(eq(accountsTable.id, existingAccount.id))
    .returning()

  return updatedAccount ? decryptAccountTokens(updatedAccount) : null
}

// Note: We don't provide upsertOAuthToken or deleteOAuthToken because
// account creation/deletion is managed by better-auth.
// If you need to disconnect a provider, use better-auth's unlinkAccount method.
