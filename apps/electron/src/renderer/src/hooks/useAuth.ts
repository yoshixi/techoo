import { useState, useEffect, useCallback } from 'react'
import { authClient, clearAuthState, getJwt, userFromJwt } from '../lib/auth'
import {
  onAuthSessionInvalidated,
  SESSION_INVALID_REASON,
  type SessionInvalidReason
} from '../lib/session-invalidation'

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

function messageForInvalidSession(reason: SessionInvalidReason): string {
  switch (reason) {
    case SESSION_INVALID_REASON.API_UNAUTHORIZED:
      return 'Your session expired or is no longer valid. Please sign in again.'
    case SESSION_INVALID_REASON.TOKEN_EXCHANGE_FAILED:
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
      // Relaunch: JWT is memory-only, so this exchanges the persisted session token.
      const jwt = await getJwt()
      if (!jwt) {
        setUser(null)
        return
      }

      const authUser = userFromJwt(jwt)
      if (authUser) {
        setUser(authUser)
      } else {
        setUser(null)
      }
    } catch {
      // Transient errors must not wipe the stored session token.
      setUser(null)
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
