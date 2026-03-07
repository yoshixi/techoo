import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { AuthScreen } from './AuthScreen'
import { CharacterIllustration } from './CharacterIllustration'
import App from '../App'

export function AuthGate(): React.JSX.Element {
  const { isAuthenticated, isLoading, refreshAuth } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <CharacterIllustration mood="thinking" size="lg" />
        <p className="text-sm text-muted-foreground">One moment...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={refreshAuth} />
  }

  return <App />
}
