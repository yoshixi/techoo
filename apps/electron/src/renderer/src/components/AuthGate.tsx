import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { AuthScreen } from './AuthScreen'
import App from '../App'

export function AuthGate(): React.JSX.Element {
  const { isAuthenticated, isLoading, refreshAuth } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontSize: '1rem',
          color: '#666'
        }}
      >
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={refreshAuth} />
  }

  return <App />
}
