import { createRoute } from '@hono/zod-openapi'
import {
  AuthUrlQueryModel,
  AuthUrlResponseModel,
  TokenRequestModel,
  TokenResponseModel,
} from '../../../core/oauth.core'
import { ErrorResponseModel } from '../../../core/common.core'

// GET /auth/url - Generate OAuth authorization URL
export const getAuthUrlRoute = createRoute({
  method: 'get',
  path: '/auth/url',
  summary: 'Get OAuth authorization URL',
  description: 'Generate a Clerk OAuth authorization URL with PKCE. This is a public endpoint (no auth required).',
  request: {
    query: AuthUrlQueryModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthUrlResponseModel
        }
      },
      description: 'Authorization URL generated successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid redirect_uri'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})

// POST /auth/token - Exchange authorization code for tokens
export const exchangeTokenRoute = createRoute({
  method: 'post',
  path: '/auth/token',
  summary: 'Exchange authorization code for tokens',
  description: 'Exchange an OAuth authorization code for access/refresh tokens. This is a public endpoint (no auth required).',
  request: {
    body: {
      content: {
        'application/json': {
          schema: TokenRequestModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TokenResponseModel
        }
      },
      description: 'Tokens exchanged successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid request (missing parameters, invalid session, etc.)'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Token exchange failed (invalid code, expired session, etc.)'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})
