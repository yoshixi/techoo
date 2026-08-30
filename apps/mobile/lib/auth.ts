import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL } from './api/baseUrl'
import { notifySessionInvalidated } from './sessionEvents'

const SESSION_TOKEN_KEY = 'session_token'

/** Do not send the platform cookie jar — it triggers better-auth CSRF checks without Origin. */
const AUTH_FETCH_INIT = { credentials: 'omit' as RequestCredentials }

/**
 * better-auth rejects POST requests that include cookies but no Origin header.
 * React Native fetch omits Origin; send the API base URL (same as BETTER_AUTH_URL in dev).
 */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Origin: API_BASE_URL,
    ...extra,
  }
}

function authJsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...authHeaders(),
    'Content-Type': 'application/json',
    ...extra,
  }
}

function parseAuthError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') return data.message
    if ('error' in data && typeof data.error === 'string') return data.error
  }
  return fallback
}

/** Session token from sign-in/sign-up — prefer JSON body (RN-friendly), fall back to header. */
function sessionTokenFromAuthResponse(
  data: { token?: string },
  res: Response
): string | null {
  if (typeof data.token === 'string' && data.token.length > 0) return data.token
  const header = res.headers.get('set-auth-token')
  if (!header) return null
  try {
    return decodeURIComponent(header)
  } catch {
    return header
  }
}

/** Read user claims from a JWT issued by our backend (already validated via /api/token). */
export function userFromJwt(jwt: string): { id: string; email: string; name: string } | null {
  try {
    const segment = jwt.split('.')[1]
    if (!segment) return null
    const payload = JSON.parse(
      atob(segment.replace(/-/g, '+').replace(/_/g, '/'))
    ) as { sub?: string | number; email?: string; name?: string }
    if (payload.sub == null || !payload.email) return null
    return {
      id: String(payload.sub),
      email: payload.email,
      name: payload.name ?? '',
    }
  } catch {
    return null
  }
}

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
      ...AUTH_FETCH_INIT,
      method: 'POST',
      headers: authJsonHeaders({ Authorization: `Bearer ${sessionToken}` }),
      // RN may send Content-Type: application/json on POST; an empty body breaks OpenAPI JSON parsing.
      body: '{}',
    })
    if (!res.ok) {
      if (res.status === 401) {
        await clearAuthState()
        notifySessionInvalidated()
      }
      throw new Error('Token exchange failed')
    }

    const { token } = await res.json()
    jwtToken = token
    jwtExpiresAt = Date.now() + 14 * 60 * 1000 // ~14 min (conservative)
    return jwtToken
  } catch {
    return null
  }
}

export async function exchangeSessionCode(code: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/token`, {
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: authJsonHeaders(),
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
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: authJsonHeaders({ Authorization: `Bearer ${sessionToken}` }),
    body: '{}',
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
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ email, password }),
  })

  const data = (await res.json()) as { token?: string; message?: string; error?: string }

  if (!res.ok) {
    throw new Error(parseAuthError(data, 'Sign in failed'))
  }

  const sessionToken = sessionTokenFromAuthResponse(data, res)
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
    ...AUTH_FETCH_INIT,
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ email, password, name }),
  })

  const data = (await res.json()) as { token?: string; message?: string; error?: string }

  if (!res.ok) {
    throw new Error(parseAuthError(data, 'Sign up failed'))
  }

  const sessionToken = sessionTokenFromAuthResponse(data, res)
  if (!sessionToken) {
    throw new Error('No session token received')
  }

  await setSessionToken(sessionToken)
  return sessionToken
}
