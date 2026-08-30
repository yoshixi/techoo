import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { router } from 'expo-router'
import { initAuth, getJwt, clearAuthState, userFromJwt } from '@/lib/auth'
import { subscribeSessionInvalidated } from '@/lib/sessionEvents'

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

      const authUser = userFromJwt(jwt)
      if (authUser) {
        setUser(authUser)
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

  useEffect(() => {
    return subscribeSessionInvalidated(() => {
      setUser(null)
      router.replace('/auth')
    })
  }, [])

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
