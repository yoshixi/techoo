import { z } from '@hono/zod-openapi'

// GET /auth/url - Query parameters
export const AuthUrlQueryModel = z.object({
  redirect_uri: z.string().url().openapi({
    description: 'Client callback URL where auth code will be sent',
    example: 'shuchu://auth/callback'
  })
}).openapi('AuthUrlQuery')

// GET /auth/url - Response
export const AuthUrlResponseModel = z.object({
  authUrl: z.string().url().openapi({
    description: 'Clerk authorization URL to open in browser',
    example: 'https://your-app.clerk.accounts.dev/oauth/authorize?...'
  }),
  sessionId: z.string().uuid().openapi({
    description: 'Session ID to include when exchanging code for tokens',
    example: '019414a7-cd12-7000-8000-000000000001'
  })
}).openapi('AuthUrlResponse')

// POST /auth/token - Request body
export const TokenRequestModel = z.object({
  code: z.string().min(1).openapi({
    description: 'Authorization code from OAuth callback',
    example: 'auth_code_abc123'
  }),
  state: z.string().min(1).openapi({
    description: 'State parameter from OAuth callback (CSRF protection)',
    example: 'random_state_xyz789'
  }),
  sessionId: z.string().uuid().openapi({
    description: 'Session ID from initial auth URL request',
    example: '019414a7-cd12-7000-8000-000000000001'
  })
}).openapi('TokenRequest')

// POST /auth/token - Response
export const TokenResponseModel = z.object({
  accessToken: z.string().openapi({
    description: 'OAuth access token',
    example: 'access_token_xxx'
  }),
  idToken: z.string().optional().openapi({
    description: 'OIDC ID token (JWT for backend verification)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
  }),
  refreshToken: z.string().optional().openapi({
    description: 'Refresh token for obtaining new access tokens',
    example: 'refresh_token_yyy'
  }),
  expiresIn: z.number().int().positive().openapi({
    description: 'Token lifetime in seconds',
    example: 3600
  })
}).openapi('TokenResponse')

// Export types
export type AuthUrlQuery = z.infer<typeof AuthUrlQueryModel>
export type AuthUrlResponse = z.infer<typeof AuthUrlResponseModel>
export type TokenRequest = z.infer<typeof TokenRequestModel>
export type TokenResponse = z.infer<typeof TokenResponseModel>
