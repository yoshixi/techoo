import React, { useState } from 'react'
import { authClient, getJwt } from '../lib/auth'
import { CharacterIllustration } from './CharacterIllustration'

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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '400px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <CharacterIllustration mood="idle" size="lg" className="mx-auto" />
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Welcome to Comori
        </h1>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div
              style={{
                color: '#b45309',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                padding: '0.5rem',
                backgroundColor: '#fffbeb',
                borderRadius: '4px'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontSize: '1rem'
            }}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ margin: '1.5rem 0', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
          or
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => handleSocialSignIn('google')}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: 'white',
              fontSize: '0.875rem'
            }}
          >
            Sign in with Google
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          {mode === 'signin' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
