import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { initAuth, getJwt, clearAuthState, getSessionToken } from '@/lib/auth'
import { API_BASE_URL } from '@/lib/api/baseUrl'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => {},
  refreshAuth: async () => {},
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const hasSession = await initAuth()
      if (!hasSession) {
        setUser(null)
        return
      }

      const jwt = await getJwt()
      if (!jwt) {
        setUser(null)
        return
      }

      const sessionToken = await getSessionToken()
      if (!sessionToken) {
        setUser(null)
        await clearAuthState()
        return
      }

      const res = await fetch(`${API_BASE_URL}/api/session`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (!res.ok) {
        setUser(null)
        await clearAuthState()
        return
      }

      const session = await res.json()
      if (session?.user) {
        setUser({
          id: String(session.user.id),
          email: session.user.email,
          name: session.user.name,
        })
      } else {
        setUser(null)
        await clearAuthState()
      }
    } catch {
      setUser(null)
      await clearAuthState()
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const signOut = useCallback(async () => {
    await clearAuthState()
    setUser(null)
  }, [])

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signOut,
    refreshAuth: checkAuth,
  }
}
