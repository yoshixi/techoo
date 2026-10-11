import { createAuthClient } from 'better-auth/client'

import { peekSessionToken, setSessionToken } from './auth-tokens'

export {
  clearAuthState,
  getJwt,
  getSessionToken,
  invalidateAuthSession,
  setSessionToken,
  userFromJwt,
  type GetJwtOptions
} from './auth-tokens'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  basePath: '/api/auth',
  fetchOptions: {
    onSuccess: (ctx) => {
      const sessionToken = ctx.response.headers.get('set-auth-token')
      if (sessionToken) {
        void setSessionToken(sessionToken)
      }
    },
    auth: {
      type: 'Bearer',
      token: () => peekSessionToken()
    }
  }
})
