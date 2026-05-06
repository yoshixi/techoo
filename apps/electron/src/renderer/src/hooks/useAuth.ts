import { useState, useEffect, useCallback } from 'react'
import { authClient, clearAuthState, getJwt, getSessionToken, invalidateAuthSession } from '../lib/auth'
import { onAuthSessionInvalidated } from '../lib/session-invalidation'

interface AuthUser {
  id: string
  email: string
  name: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Shown on AuthScreen after remote invalidation (401, token refresh failure, etc.) */
  sessionPrompt: string | null
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

function messageForInvalidSession(reason: string): string {
  switch (reason) {
    case 'api-unauthorized':
      return 'Your session expired or is no longer valid. Please sign in again.'
    case 'token-exchange-failed':
      return 'Could not refresh your session. Please sign in again.'
    default:
      return 'Please sign in again.'
  }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionPrompt, setSessionPrompt] = useState<string | null>(null)

  useEffect(() => {
    return onAuthSessionInvalidated(({ reason }) => {
      setUser(null)
      setIsLoading(false)
      setSessionPrompt(messageForInvalidSession(reason))
    })
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      // Try to get a valid JWT (will use cached or refresh from session token)
      const jwt = await getJwt()
      if (!jwt) {
        setUser(null)
        return
      }

      const sessionToken = await getSessionToken()
      if (!sessionToken) {
        setUser(null)
        invalidateAuthSession('session-check-failed')
        return
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'}/api/session`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }
      )
      if (!res.ok) {
        setUser(null)
        invalidateAuthSession('session-check-failed')
        return
      }
      const session = await res.json()
      if (session?.user) {
        setUser({
          id: String(session.user.id),
          email: session.user.email,
          name: session.user.name
        })
      } else {
        setUser(null)
        invalidateAuthSession('session-check-failed')
      }
    } catch {
      setUser(null)
      invalidateAuthSession('session-check-failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut()
    } catch {
      // Continue with local cleanup even if server sign-out fails
    }
    clearAuthState()
    setSessionPrompt(null)
    setUser(null)
  }, [])

  const refreshAuth = useCallback(async () => {
    setSessionPrompt(null)
    await checkAuth()
  }, [checkAuth])

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    sessionPrompt,
    signOut,
    refreshAuth
  }
}
