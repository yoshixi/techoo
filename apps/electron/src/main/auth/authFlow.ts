import { shell, app } from 'electron'
import { setTokens, getTokens, clearTokens, isTokenExpired, type TokenData } from './tokenStorage'

// Clerk configuration from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.MAIN_VITE_CLERK_PUBLISHABLE_KEY || ''
const CLERK_FRONTEND_API = import.meta.env.MAIN_VITE_CLERK_FRONTEND_API || ''

// Custom protocol for OAuth callback
const PROTOCOL = 'shuchu'
const CALLBACK_PATH = 'auth/callback'
const REDIRECT_URI = `${PROTOCOL}://${CALLBACK_PATH}`

// Auth state for PKCE flow
let authState: string | null = null
let codeVerifier: string | null = null

// Callback to notify renderer of auth state changes
let onAuthStateChange: ((authenticated: boolean) => void) | null = null

/**
 * Set callback for auth state changes.
 */
export function setAuthStateChangeCallback(callback: (authenticated: boolean) => void): void {
  onAuthStateChange = callback
}

/**
 * Generate a random string for PKCE.
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}

/**
 * Generate SHA256 hash for PKCE code challenge.
 */
async function sha256(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  return crypto.subtle.digest('SHA-256', data)
}

/**
 * Base64 URL encode for PKCE.
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Register the custom protocol handler.
 * Must be called before app is ready.
 */
export function registerProtocolHandler(): void {
  if (process.defaultApp) {
    // Development mode
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
    }
  } else {
    // Production mode
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

/**
 * Handle the OAuth callback URL.
 * Returns true if the URL was handled.
 */
export async function handleOAuthCallback(url: string): Promise<boolean> {
  if (!url.startsWith(`${PROTOCOL}://${CALLBACK_PATH}`)) {
    return false
  }

  try {
    const urlObj = new URL(url)
    const code = urlObj.searchParams.get('code')
    const state = urlObj.searchParams.get('state')
    const error = urlObj.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error, urlObj.searchParams.get('error_description'))
      onAuthStateChange?.(false)
      return true
    }

    if (!code || !state || state !== authState) {
      console.error('Invalid OAuth callback: missing code or state mismatch')
      onAuthStateChange?.(false)
      return true
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code)
    onAuthStateChange?.(true)
    return true
  } catch (error) {
    console.error('Failed to handle OAuth callback:', error)
    onAuthStateChange?.(false)
    return true
  }
}

/**
 * Initiate the OAuth login flow.
 * Opens Clerk's hosted sign-in page in the system browser.
 */
export async function login(): Promise<void> {
  if (!CLERK_FRONTEND_API || !CLERK_PUBLISHABLE_KEY) {
    throw new Error('Clerk configuration is missing. Set MAIN_VITE_CLERK_FRONTEND_API and MAIN_VITE_CLERK_PUBLISHABLE_KEY.')
  }

  // Generate PKCE values
  authState = generateRandomString(32)
  codeVerifier = generateRandomString(64)
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier))

  // Build Clerk authorization URL
  const authUrl = new URL(`https://${CLERK_FRONTEND_API}/oauth/authorize`)
  authUrl.searchParams.set('client_id', CLERK_PUBLISHABLE_KEY)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', authState)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('scope', 'openid profile email')

  // Open in system browser
  await shell.openExternal(authUrl.toString())
}

/**
 * Exchange authorization code for tokens.
 */
async function exchangeCodeForTokens(code: string): Promise<void> {
  if (!codeVerifier) {
    throw new Error('No code verifier available')
  }

  const tokenUrl = `https://${CLERK_FRONTEND_API}/oauth/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLERK_PUBLISHABLE_KEY,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()

  // Calculate expiry time
  const expiresIn = data.expires_in || 3600 // Default to 1 hour
  const expiresAt = Date.now() + expiresIn * 1000

  const tokens: TokenData = {
    accessToken: data.access_token,
    idToken: data.id_token, // OIDC ID token for backend verification
    refreshToken: data.refresh_token,
    expiresAt
  }

  setTokens(tokens)

  // Clear PKCE values
  authState = null
  codeVerifier = null
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const tokens = getTokens()
  if (!tokens?.refreshToken) {
    return false
  }

  try {
    const tokenUrl = `https://${CLERK_FRONTEND_API}/oauth/token`

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLERK_PUBLISHABLE_KEY,
        refresh_token: tokens.refreshToken
      })
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return false
    }

    const data = await response.json()

    const expiresIn = data.expires_in || 3600
    const expiresAt = Date.now() + expiresIn * 1000

    const newTokens: TokenData = {
      accessToken: data.access_token,
      idToken: data.id_token || tokens.idToken,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt
    }

    setTokens(newTokens)
    return true
  } catch (error) {
    console.error('Failed to refresh token:', error)
    return false
  }
}

/**
 * Get the current access token.
 * Automatically refreshes if expired and refresh token is available.
 */
export async function getAccessToken(): Promise<string | null> {
  const tokens = getTokens()
  if (!tokens) {
    return null
  }

  if (isTokenExpired()) {
    // Try to refresh
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      clearTokens()
      onAuthStateChange?.(false)
      return null
    }
    const newTokens = getTokens()
    return newTokens?.accessToken || null
  }

  return tokens.accessToken
}

/**
 * Logout - clear all stored tokens.
 */
export function logout(): void {
  clearTokens()
  onAuthStateChange?.(false)
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
  const tokens = getTokens()
  return tokens !== null
}
