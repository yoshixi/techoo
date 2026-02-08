import { useState, useEffect, useCallback } from 'react'
import { authClient, clearAuthState, getJwt } from '../lib/auth'

interface AuthUser {
  id: string
  email: string
  name: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      // Try to get a valid JWT (will use cached or refresh from session token)
      const jwt = await getJwt()
      if (!jwt) {
        setUser(null)
        return
      }

      // Get session info from better-auth
      const { data: session } = await authClient.getSession()
      if (session?.user) {
        setUser({
          id: String(session.user.id),
          email: session.user.email,
          name: session.user.name
        })
      } else {
        setUser(null)
        clearAuthState()
      }
    } catch {
      setUser(null)
      clearAuthState()
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
    setUser(null)
  }, [])

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signOut,
    refreshAuth: checkAuth
  }
}
