import { createAuthClient } from 'better-auth/client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_BASE_URL = `${BASE_URL}/api`

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  basePath: '/api/auth',
  fetchOptions: {
    onSuccess: (ctx) => {
      const sessionToken = ctx.response.headers.get('set-auth-token')
      if (sessionToken) {
        localStorage.setItem('session_token', sessionToken)
      }
    },
    auth: {
      type: 'Bearer',
      token: () => localStorage.getItem('session_token') || ''
    }
  }
})

// JWT Token Manager
let jwtToken: string | null = null
let jwtExpiresAt: number = 0

export async function getJwt(): Promise<string | null> {
  // Return cached JWT if still valid (with 60s safety buffer)
  if (jwtToken && Date.now() < jwtExpiresAt - 60_000) {
    return jwtToken
  }

  // Exchange session token for a new JWT
  const sessionToken = localStorage.getItem('session_token')
  if (!sessionToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    if (!res.ok) throw new Error('Token exchange failed')

    const { token } = await res.json()
    jwtToken = token
    jwtExpiresAt = Date.now() + 14 * 60 * 1000 // ~14 min (conservative)
    window.api.updateAuthToken(jwtToken)
    return jwtToken
  } catch {
    // Session expired — clear all auth state so stale tokens don't
    // cause repeated 401s from tray/notification requests
    clearAuthState()
    return null
  }
}

export function clearAuthState(): void {
  localStorage.removeItem('session_token')
  jwtToken = null
  jwtExpiresAt = 0
  window.api.updateAuthToken(null)
}
