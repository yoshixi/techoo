import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { customInstance } from './mutator'
import { clearAuthState, getSessionToken } from '../auth-tokens'
import { onAuthSessionInvalidated } from '../session-invalidation'

function encodeJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  const body = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${header}.${body}.sig`
}

function jwtForUser(expSecondsFromNow = 900): string {
  return encodeJwt({
    sub: '42',
    email: 'user@example.com',
    name: 'Ada',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow
  })
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('customInstance auth retry', () => {
  const fetchMock = vi.fn()
  let persistedSession: string | null
  const invalidationReasons: string[] = []
  let unsubscribeInvalidation: () => void

  beforeEach(() => {
    persistedSession = 'session-token'
    fetchMock.mockReset()
    invalidationReasons.length = 0
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', {
      api: {
        getSessionToken: async () => persistedSession,
        setSessionToken: async (token: string) => {
          persistedSession = token
        },
        clearSessionToken: async () => {
          persistedSession = null
        },
        updateAuthToken: vi.fn()
      }
    })
    unsubscribeInvalidation = onAuthSessionInvalidated(({ reason }) => {
      invalidationReasons.push(reason)
    })
    clearAuthState()
    persistedSession = 'session-token'
  })

  afterEach(() => {
    unsubscribeInvalidation()
    vi.unstubAllGlobals()
  })

  it('refreshes the JWT and retries once after an API 401', async () => {
    const expired = jwtForUser()
    const fresh = jwtForUser()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { token: expired }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { token: fresh }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))

    const result = await customInstance<{ data: unknown[] }>({
      url: '/api/v1/todos',
      method: 'GET'
    })

    expect(result).toEqual({ data: [] })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(invalidationReasons).toEqual([])
    expect(await getSessionToken()).toBe('session-token')

    const retryAuth = fetchMock.mock.calls[3]?.[1] as RequestInit
    const headers = retryAuth.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${fresh}`)
  })

  it('does not sign the user out when a Google calendar route returns 401', async () => {
    const jwt = jwtForUser()
    const googleBody = {
      error: 'Google session expired; re-link your Google account.',
      code: 'GOOGLE_TOKEN_EXPIRED'
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { token: jwt }))
      .mockResolvedValueOnce(jsonResponse(401, googleBody))
      .mockResolvedValueOnce(jsonResponse(200, { token: jwt }))
      .mockResolvedValueOnce(jsonResponse(401, googleBody))

    await expect(
      customInstance({ url: '/api/calendars/available', method: 'GET' })
    ).rejects.toThrow(/HTTP 401/)

    expect(invalidationReasons).toEqual([])
    expect(persistedSession).toBe('session-token')
  })
})
