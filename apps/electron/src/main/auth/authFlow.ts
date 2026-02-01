import { shell, app } from 'electron'
import { setTokens, getTokens, clearTokens, isTokenExpired, type TokenData } from './tokenStorage'

// API URL from environment
const API_URL = import.meta.env.MAIN_VITE_API_URL || 'http://localhost:3000'

// Custom protocol for OAuth callback
const PROTOCOL = 'shuchu'
const CALLBACK_PATH = 'auth/callback'
const REDIRECT_URI = `${PROTOCOL}://${CALLBACK_PATH}`

// Session ID from last login attempt
let pendingSessionId: string | null = null
let pendingState: string | null = null

// Callback to notify renderer of auth state changes
let onAuthStateChange: ((authenticated: boolean) => void) | null = null

/**
 * Set callback for auth state changes.
 */
export function setAuthStateChangeCallback(callback: (authenticated: boolean) => void): void {
  onAuthStateChange = callback
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
      pendingSessionId = null
      pendingState = null
      onAuthStateChange?.(false)
      return true
    }

    if (!code || !state || !pendingSessionId) {
      console.error('Invalid OAuth callback: missing code, state, or sessionId')
      pendingSessionId = null
      pendingState = null
      onAuthStateChange?.(false)
      return true
    }

    // Exchange code for tokens via backend
    await exchangeCodeForTokens(code, state, pendingSessionId)
    pendingSessionId = null
    pendingState = null
    onAuthStateChange?.(true)
    return true
  } catch (error) {
    console.error('Failed to handle OAuth callback:', error)
    pendingSessionId = null
    pendingState = null
    onAuthStateChange?.(false)
    return true
  }
}

/**
 * Initiate the OAuth login flow.
 * Requests auth URL from backend and opens it in the system browser.
 */
export async function login(): Promise<void> {
  // Get auth URL from backend
  const response = await fetch(`${API_URL}/api/auth/url?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get auth URL: ${error}`)
  }

  const { authUrl, sessionId } = (await response.json()) as { authUrl: string; sessionId: string }

  // Store session ID for callback
  pendingSessionId = sessionId

  // Open in system browser
  await shell.openExternal(authUrl)
}

/**
 * Exchange authorization code for tokens via backend.
 */
async function exchangeCodeForTokens(
  code: string,
  state: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code, state, sessionId })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = (await response.json()) as {
    accessToken: string
    idToken?: string
    refreshToken?: string
    expiresIn: number
  }

  // Calculate expiry time
  const expiresAt = Date.now() + data.expiresIn * 1000

  const tokens: TokenData = {
    accessToken: data.accessToken,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt
  }

  setTokens(tokens)
}

/**
 * Refresh the access token using the refresh token.
 * NOTE: Token refresh currently requires re-login.
 * A future enhancement could add a backend refresh endpoint.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const tokens = getTokens()
  if (!tokens?.refreshToken) {
    return false
  }

  // For now, token refresh is not implemented via backend.
  // User needs to re-login when token expires.
  // TODO: Implement POST /auth/refresh endpoint on backend
  console.warn('Token refresh not implemented, user needs to re-login')
  return false
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
