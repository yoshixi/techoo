import {
  notifyAuthSessionInvalidated,
  SESSION_INVALID_REASON,
  type SessionInvalidReason
} from './session-invalidation'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
const API_BASE_URL = `${BASE_URL}/api`
const JWT_REFRESH_BUFFER_MS = 60_000
const JWT_FALLBACK_TTL_MS = 14 * 60 * 1000
const TOKEN_EXCHANGE_RETRY_DELAY_MS = 300

let sessionTokenCache: string | null = null
let jwtToken: string | null = null
let jwtExpiresAt = 0
let refreshInFlight: Promise<string | null> | null = null

export type GetJwtOptions = {
  /** Bypass the in-memory JWT cache (e.g. after an API 401). */
  forceRefresh?: boolean
}

export function peekSessionToken(): string {
  return sessionTokenCache || ''
}

export async function getSessionToken(): Promise<string | null> {
  if (sessionTokenCache !== null) return sessionTokenCache
  sessionTokenCache = await window.api.getSessionToken()
  return sessionTokenCache
}

export async function setSessionToken(token: string): Promise<void> {
  sessionTokenCache = token
  await window.api.setSessionToken(token)
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const segment = jwt.split('.')[1]
    if (!segment) return null
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = padded.length % 4
    const withPad = padLen === 0 ? padded : padded + '='.repeat(4 - padLen)
    const json = atob(withPad)
    const payload = JSON.parse(json) as unknown
    if (!payload || typeof payload !== 'object') return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

/** Read user claims from a JWT issued by our backend (already validated via /api/token). */
export function userFromJwt(jwt: string): { id: string; email: string; name: string } | null {
  const payload = decodeJwtPayload(jwt)
  if (!payload || payload.sub == null || typeof payload.email !== 'string') return null
  return {
    id: String(payload.sub),
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : ''
  }
}

function jwtExpiryMs(jwt: string): number {
  const payload = decodeJwtPayload(jwt)
  if (payload && typeof payload.exp === 'number') {
    return payload.exp * 1000
  }
  return Date.now() + JWT_FALLBACK_TTL_MS
}

function isJwtCacheValid(): boolean {
  return Boolean(jwtToken) && Date.now() < jwtExpiresAt - JWT_REFRESH_BUFFER_MS
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function exchangeSessionForJwt(sessionToken: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    // Empty JSON object: some runtimes/OpenAPI stacks reject a POST with no body.
    body: '{}'
  })
}

/**
 * Return cached JWT if still valid, otherwise exchange the persisted session token.
 * On relaunch the JWT cache is empty, so this always refreshes from the session token.
 *
 * Transient failures (network, 5xx) keep the stored session. Only 401/403 from
 * `/api/token` mean the session is actually dead.
 */
export async function getJwt(options: GetJwtOptions = {}): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  if (!options.forceRefresh && isJwtCacheValid()) {
    return jwtToken
  }

  refreshInFlight = refreshJwtFromSession().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function refreshJwtFromSession(): Promise<string | null> {
  const sessionToken = await getSessionToken()
  if (!sessionToken) return null

  let res: Response | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await exchangeSessionForJwt(sessionToken)
      if (res.ok || res.status === 401 || res.status === 403) break
    } catch {
      if (attempt === 0) {
        await delay(TOKEN_EXCHANGE_RETRY_DELAY_MS)
        continue
      }
      // Network error after retry — keep the session so relaunch / later calls can recover.
      return null
    }
  }

  if (!res) return null

  if (res.status === 401 || res.status === 403) {
    invalidateAuthSession(SESSION_INVALID_REASON.TOKEN_EXCHANGE_FAILED)
    return null
  }

  if (!res.ok) {
    return null
  }

  const data = (await res.json()) as { token?: unknown }
  if (typeof data.token !== 'string' || data.token.length === 0) {
    return null
  }

  // Sign-out or invalidation may have raced with this refresh.
  const currentSession = await getSessionToken()
  if (currentSession !== sessionToken) return null

  jwtToken = data.token
  jwtExpiresAt = jwtExpiryMs(data.token)
  window.api.updateAuthToken(jwtToken)
  return jwtToken
}

export function clearAuthState(): void {
  sessionTokenCache = null
  jwtToken = null
  jwtExpiresAt = 0
  refreshInFlight = null
  void window.api.clearSessionToken()
  window.api.updateAuthToken(null)
}

/** Clears stored credentials and notifies the UI (sign-out uses {@link clearAuthState} only). */
export function invalidateAuthSession(reason: SessionInvalidReason): void {
  clearAuthState()
  notifyAuthSessionInvalidated(reason)
}
