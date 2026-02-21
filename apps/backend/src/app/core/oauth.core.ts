import { z } from '@hono/zod-openapi'

// Provider types
export const ProviderTypeEnum = z.enum(['google', 'outlook', 'apple'])
export type ProviderType = z.infer<typeof ProviderTypeEnum>

// OAuth token model (API representation)
export const OAuthTokenModel = z.object({
  id: z.string().openapi({
    description: 'Unique identifier for the OAuth token'
  }),
  userId: z.string().openapi({
    description: 'User ID'
  }),
  providerType: ProviderTypeEnum.openapi({
    description: 'OAuth provider type',
    example: 'google'
  }),
  expiresAt: z.string().nullable().openapi({
    description: 'Token expiration timestamp',
    example: '2024-12-31T23:59:59.000Z'
  }),
  scope: z.string().openapi({
    description: 'Granted scopes',
    example: 'https://www.googleapis.com/auth/calendar.readonly'
  }),
  createdAt: z.string().openapi({
    description: 'Timestamp when the token was created',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().openapi({
    description: 'Timestamp when the token was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('OAuthToken')

// OAuth status response
export const OAuthStatusResponseModel = z.object({
  connected: z.boolean().openapi({
    description: 'Whether the user has a valid OAuth connection'
  }),
  providerType: ProviderTypeEnum.optional().openapi({
    description: 'The connected provider type'
  }),
  expiresAt: z.string().optional().nullable().openapi({
    description: 'Token expiration timestamp'
  })
}).openapi('OAuthStatusResponse')

// OAuth authorization URL response
export const OAuthAuthUrlResponseModel = z.object({
  authUrl: z.string().url().openapi({
    description: 'URL to redirect user for OAuth authorization',
    example: 'https://accounts.google.com/o/oauth2/v2/auth?...'
  })
}).openapi('OAuthAuthUrlResponse')

// OAuth callback query parameters
export const OAuthCallbackQueryModel = z.object({
  code: z.string().openapi({
    description: 'Authorization code from OAuth provider'
  }),
  state: z.string().optional().openapi({
    description: 'State parameter for CSRF protection'
  }),
  error: z.string().optional().openapi({
    description: 'Error code if authorization failed'
  })
}).openapi('OAuthCallbackQuery')

// OAuth disconnect response
export const OAuthDisconnectResponseModel = z.object({
  success: z.boolean().openapi({
    description: 'Whether the disconnect was successful'
  }),
  message: z.string().openapi({
    description: 'Result message',
    example: 'Google OAuth disconnected successfully'
  })
}).openapi('OAuthDisconnectResponse')

export const OAuthAccountModel = z.object({
  id: z.string().openapi({
    description: 'Unique identifier for the account record'
  }),
  userId: z.string().openapi({
    description: 'User ID'
  }),
  providerType: ProviderTypeEnum.openapi({
    description: 'OAuth provider type',
    example: 'google'
  }),
  accountId: z.string().openapi({
    description: 'Provider-specific account ID'
  }),
  email: z.string().email().optional().openapi({
    description: 'Email associated with the provider account'
  }),
  createdAt: z.string().openapi({
    description: 'Timestamp when the account was linked',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().openapi({
    description: 'Timestamp when the account was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('OAuthAccount')

export const OAuthAccountsResponseModel = z.object({
  accounts: z.array(OAuthAccountModel).openapi({
    description: 'Linked OAuth accounts'
  })
}).openapi('OAuthAccountsResponse')

export const OAuthAccountIdQueryModel = z.object({
  accountId: z.string().optional().openapi({
    description: 'Provider-specific account ID',
    param: {
      name: 'accountId',
      in: 'query'
    }
  })
}).openapi('OAuthAccountIdQuery')

// Export types
export type OAuthToken = z.infer<typeof OAuthTokenModel>
export type OAuthStatusResponse = z.infer<typeof OAuthStatusResponseModel>
export type OAuthAuthUrlResponse = z.infer<typeof OAuthAuthUrlResponseModel>
export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQueryModel>
export type OAuthDisconnectResponse = z.infer<typeof OAuthDisconnectResponseModel>
export type OAuthAccount = z.infer<typeof OAuthAccountModel>
export type OAuthAccountsResponse = z.infer<typeof OAuthAccountsResponseModel>
export type OAuthAccountIdQuery = z.infer<typeof OAuthAccountIdQueryModel>
