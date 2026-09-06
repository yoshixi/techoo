import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { onAuthSessionInvalidated, SESSION_INVALID_REASON } from './session-invalidation'
import { clearAuthState, getJwt, getSessionToken, userFromJwt } from './auth-tokens'

const TOKEN_URL = 'http://localhost:8787/api/token'

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

describe('auth-tokens', () => {
  const fetchMock = vi.fn()
  let persistedSession: string | null
  const updateAuthToken = vi.fn()
  const invalidationReasons: string[] = []
  let unsubscribeInvalidation: () => void

  beforeEach(() => {
    persistedSession = 'session-token'
    updateAuthToken.mockReset()
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
        updateAuthToken
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('parses user claims from a JWT', () => {
    const jwt = jwtForUser()
    expect(userFromJwt(jwt)).toEqual({
      id: '42',
      email: 'user@example.com',
      name: 'Ada'
    })
  })

  it('exchanges the persisted session token for a JWT on relaunch (empty cache)', async () => {
    const jwt = jwtForUser()
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token: jwt }))

    const result = await getJwt()

    expect(result).toBe(jwt)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(TOKEN_URL)
    expect(updateAuthToken).toHaveBeenCalledWith(jwt)
  })

  it('returns the cached JWT without hitting /token again', async () => {
    const jwt = jwtForUser()
    fetchMock.mockResolvedValue(jsonResponse(200, { token: jwt }))

    await getJwt()
    await getJwt()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forceRefresh bypasses a still-valid cache', async () => {
    const first = jwtForUser()
    const second = jwtForUser()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { token: first }))
      .mockResolvedValueOnce(jsonResponse(200, { token: second }))

    expect(await getJwt()).toBe(first)
    expect(await getJwt({ forceRefresh: true })).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent refreshes into one /token call', async () => {
    const jwt = jwtForUser()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    fetchMock.mockImplementationOnce(async () => {
      await gate
      return jsonResponse(200, { token: jwt })
    })

    const pending = Promise.all([getJwt(), getJwt()])
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    release()
    expect(await pending).toEqual([jwt, jwt])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not clear the session when /token is unreachable', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new Error('network down'))

    const jwtPromise = getJwt()
    await vi.advanceTimersByTimeAsync(400)
    expect(await jwtPromise).toBeNull()

    expect(invalidationReasons).toEqual([])
    expect(await getSessionToken()).toBe('session-token')
    expect(persistedSession).toBe('session-token')
  })

  it('does not clear the session on a 5xx from /token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: 'unavailable' }))

    expect(await getJwt()).toBeNull()
    expect(invalidationReasons).toEqual([])
    expect(persistedSession).toBe('session-token')
  })

  it('clears the session only when /token rejects it as unauthorized', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))

    expect(await getJwt()).toBeNull()
    expect(invalidationReasons).toEqual([SESSION_INVALID_REASON.TOKEN_EXCHANGE_FAILED])
    expect(persistedSession).toBeNull()
  })
})
