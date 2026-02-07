import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  clerk,
  initClerk,
  isAuthenticated as checkClerkAuth,
  signOut as clerkSignOut,
  onSessionChange
} from '../lib/clerk'
import { onAuthRequired } from '../lib/api/mutator'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Clerk and check auth state
  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        await initClerk()
        setIsAuthenticated(checkClerkAuth())
      } catch (error) {
        console.error('Failed to initialize Clerk:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  // Listen for session changes from Clerk
  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setIsAuthenticated(session !== null && session !== undefined)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  // Listen for OAuth callback URL from main process
  useEffect(() => {
    const unsubscribe = window.api.auth.onCallbackUrl(async (url) => {
      setIsLoading(true)
      try {
        // Clerk handles the callback internally
        await clerk.handleRedirectCallback({
          redirectUrl: url
        })
        setIsAuthenticated(checkClerkAuth())
      } catch (error) {
        console.error('Failed to handle OAuth callback:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    })

    return unsubscribe
  }, [])

  // Listen for 401 responses from API calls
  useEffect(() => {
    const unsubscribe = onAuthRequired(() => {
      setIsAuthenticated(false)
    })

    return unsubscribe
  }, [])

  const login = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      // Get redirect URI from main process (different in dev vs prod)
      const redirectUrl = await window.api.auth.getRedirectUri()

      // Create a sign-in attempt with OAuth
      const signIn = clerk.client?.signIn
      if (!signIn) {
        throw new Error('Clerk client not available')
      }

      // Start OAuth flow - this returns the authorization URL
      const result = await signIn.create({
        strategy: 'oauth_google',
        redirectUrl,
        actionCompleteRedirectUrl: redirectUrl
      })

      // Get the authorization URL from the first factor
      const oauthFactor = result.firstFactorVerification
      if (oauthFactor.externalVerificationRedirectURL) {
        // Open the URL in system browser via main process
        await window.api.auth.openAuthUrl(oauthFactor.externalVerificationRedirectURL.toString())
        // Reset loading state after opening browser so user can retry if they abandon the flow
        // The callback handler will set loading to true again when callback URL is received
        setIsLoading(false)
      } else {
        throw new Error('No OAuth redirect URL available')
      }
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await clerkSignOut()
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
