import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { ToastProvider } from './components/ui/toast'

function AppWithAuth(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <App />
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <AppWithAuth />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>
)
