import React, { useState } from 'react'
import { authClient, getJwt } from '../lib/auth'
import { CharacterIllustration } from './CharacterIllustration'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardHeader, CardContent } from './ui/card'

type AuthMode = 'signin' | 'signup'

interface AuthScreenProps {
  onAuthenticated: () => void
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps): React.JSX.Element {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name
        })
        if (signUpError) {
          setError(signUpError.message || 'Sign up failed')
          return
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password
        })
        if (signInError) {
          setError(signInError.message || 'Sign in failed')
          return
        }
      }

      // Exchange session token for JWT
      const jwt = await getJwt()
      if (!jwt) {
        setError('Failed to obtain access token')
        return
      }

      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialSignIn = async (
    provider: 'google' | 'github' | 'apple'
  ): Promise<void> => {
    setError(null)
    setLoading(true)
    try {
      // Opens popup BrowserWindow for OAuth via main process
      const sessionToken = await window.api.signInWithOAuth(provider)
      if (!sessionToken) {
        setError('Sign in was cancelled or failed')
        return
      }

      // Store the session token (same as email/password flow)
      localStorage.setItem('session_token', sessionToken)

      // Exchange session token for JWT
      const jwt = await getJwt()
      if (!jwt) {
        setError('Failed to obtain access token')
        return
      }

      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${provider} sign in failed`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center">
          <CharacterIllustration mood="idle" size="lg" className="mx-auto" />
          <h1 className="text-xl font-semibold tracking-tight">Welcome to Comori</h1>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? 'One moment...'
                : mode === 'signin'
                  ? "Let's Go"
                  : 'Get Started'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSocialSignIn('google')}
          >
            Sign in with Google
          </Button>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === 'signin' ? (
              <span>
                Don&apos;t have an account?{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                  }}
                >
                  Sign Up
                </Button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                  }}
                >
                  Sign In
                </Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
