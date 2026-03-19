import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from './api/mutator'

const SESSION_TOKEN_KEY = 'session_token'

// JWT Token Manager — in-memory cache for performance
let jwtToken: string | null = null
let jwtExpiresAt: number = 0

/**
 * Initialize auth state on app start by checking for a stored session token.
 * Returns true if a session token exists (user was previously signed in).
 */
export async function initAuth(): Promise<boolean> {
  const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
  return sessionToken !== null
}

/**
 * Return cached JWT if still valid, otherwise exchange session token for a new one.
 * Returns null if no session exists.
 */
export async function getJwt(): Promise<string | null> {
  // Return cached JWT if still valid (with 60s safety buffer)
  if (jwtToken && Date.now() < jwtExpiresAt - 60_000) {
    return jwtToken
  }

  const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
  if (!sessionToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/api/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    if (!res.ok) throw new Error('Token exchange failed')

    const { token } = await res.json()
    jwtToken = token
    jwtExpiresAt = Date.now() + 14 * 60 * 1000 // ~14 min (conservative)
    return jwtToken
  } catch {
    clearAuthState()
    return null
  }
}

export async function exchangeSessionCode(code: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    throw new Error('Session code exchange failed')
  }
  const data = (await res.json()) as { session_token?: string }
  if (!data.session_token) {
    throw new Error('No session token returned from exchange')
  }
  return data.session_token
}

export async function createSessionCode(sessionToken: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/session-code`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  if (!res.ok) {
    throw new Error('Failed to create session code')
  }
  const data = (await res.json()) as { code?: string }
  if (!data.code) {
    throw new Error('No session code returned')
  }
  return data.code
}

/** Store session token in SecureStore after sign-in */
export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
}

/** Read session token from SecureStore */
export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY)
}

/** Clear all auth state from SecureStore and memory */
export async function clearAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
  jwtToken = null
  jwtExpiresAt = 0
}

/** Sign in with email and password. Returns session token on success. */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message || 'Sign in failed')
  }

  const sessionToken = res.headers.get('set-auth-token')
  if (!sessionToken) {
    throw new Error('No session token received')
  }

  await setSessionToken(sessionToken)
  return sessionToken
}

/** Sign up with email, password, and name. Returns session token on success. */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message || 'Sign up failed')
  }

  const sessionToken = res.headers.get('set-auth-token')
  if (!sessionToken) {
    throw new Error('No session token received')
  }

  await setSessionToken(sessionToken)
  return sessionToken
}
