import Store from 'electron-store'
import { safeStorage } from 'electron'

export interface TokenData {
  accessToken: string
  idToken?: string // OIDC ID token for backend verification
  refreshToken?: string
  expiresAt: number // Unix timestamp in milliseconds
}

interface StoredTokenData {
  encryptedAccessToken: string
  encryptedIdToken?: string
  encryptedRefreshToken?: string
  expiresAt: number
}

const store = new Store<{ tokens?: StoredTokenData }>({
  name: 'shuchu-auth',
  encryptionKey: 'shuchu-app-storage' // Additional layer of protection
})

/**
 * Check if encryption is available on this system.
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Store tokens securely using Electron's safeStorage.
 */
export function setTokens(tokens: TokenData): void {
  const storedData: StoredTokenData = {
    encryptedAccessToken: encryptToken(tokens.accessToken),
    expiresAt: tokens.expiresAt
  }

  if (tokens.idToken) {
    storedData.encryptedIdToken = encryptToken(tokens.idToken)
  }

  if (tokens.refreshToken) {
    storedData.encryptedRefreshToken = encryptToken(tokens.refreshToken)
  }

  store.set('tokens', storedData)
}

/**
 * Retrieve stored tokens.
 * Returns null if no tokens are stored or decryption fails.
 */
export function getTokens(): TokenData | null {
  const storedData = store.get('tokens')
  if (!storedData) {
    return null
  }

  try {
    const tokens: TokenData = {
      accessToken: decryptToken(storedData.encryptedAccessToken),
      expiresAt: storedData.expiresAt
    }

    if (storedData.encryptedIdToken) {
      tokens.idToken = decryptToken(storedData.encryptedIdToken)
    }

    if (storedData.encryptedRefreshToken) {
      tokens.refreshToken = decryptToken(storedData.encryptedRefreshToken)
    }

    return tokens
  } catch (error) {
    console.error('Failed to decrypt tokens:', error)
    // Clear corrupted data
    clearTokens()
    return null
  }
}

/**
 * Clear all stored tokens.
 */
export function clearTokens(): void {
  store.delete('tokens')
}

/**
 * Check if the stored access token is expired.
 * Returns true if expired or no tokens are stored.
 */
export function isTokenExpired(): boolean {
  const tokens = getTokens()
  if (!tokens) {
    return true
  }

  // Consider token expired 5 minutes before actual expiry
  // to account for clock skew and request time
  const bufferMs = 5 * 60 * 1000
  return Date.now() >= tokens.expiresAt - bufferMs
}

/**
 * Check if the user has valid (non-expired) tokens stored.
 */
export function hasValidTokens(): boolean {
  const tokens = getTokens()
  return tokens !== null && !isTokenExpired()
}

// Helper functions for encryption/decryption
function encryptToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token)
    return encrypted.toString('base64')
  }
  // Fallback: store as-is (less secure, but works)
  return `plain:${token}`
}

function decryptToken(encryptedToken: string): string {
  if (encryptedToken.startsWith('plain:')) {
    return encryptedToken.slice(6)
  }

  if (safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encryptedToken, 'base64')
    return safeStorage.decryptString(buffer)
  }

  throw new Error('Cannot decrypt token: encryption not available')
}
