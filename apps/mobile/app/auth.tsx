import { Redirect } from 'expo-router'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { useAuth } from '@/hooks/useAuth'

export default function AuthRoute() {
  const { isAuthenticated, refreshAuth } = useAuth()

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return <AuthScreen onAuthenticated={refreshAuth} />
}
