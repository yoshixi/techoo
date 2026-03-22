import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import { ErrorResponseModel } from '../../../core/common.core'

// Response models
const TokenResponseModel = z.object({
  token: z.string().openapi({ description: 'JWT token' }),
  session_token: z.string().optional().openapi({ description: 'Session token (returned when exchanging a code)' })
}).openapi('TokenResponse')

const SessionResponseModel = z.object({
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string()
  })
}).openapi('SessionResponse')

const SessionCodeResponseModel = z.object({
  code: z.string().openapi({ description: 'Short-lived exchange code' })
}).openapi('SessionCodeResponse')

// Request models
const TokenRequestModel = z.object({
  code: z.string().optional().openapi({ description: 'Short-lived exchange code to trade for a session token' })
}).openapi('TokenRequest')

// POST /token - Exchange session/code for JWT
export const tokenRoute = createRoute({
  method: 'post',
  path: '/token',
  summary: 'Exchange session or code for JWT',
  description: 'Accepts either a session token via Authorization header or a short-lived exchange code in the body. Returns a JWT token.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: TokenRequestModel
        }
      },
      required: false
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TokenResponseModel
        }
      },
      description: 'JWT token issued successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid or expired code'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Unauthorized'
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Account setup failed'
    }
  }
})

// GET /session - Session lookup
export const sessionRoute = createRoute({
  method: 'get',
  path: '/session',
  summary: 'Session lookup',
  description: 'Look up user and session data from a bearer session token.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SessionResponseModel
        }
      },
      description: 'Session found'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Unauthorized'
    }
  }
})

// POST /session-code - Create exchange code
export const sessionCodeRoute = createRoute({
  method: 'post',
  path: '/session-code',
  summary: 'Create exchange code',
  description: 'Create a short-lived code tied to a session token, used for OAuth redirects.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SessionCodeResponseModel
        }
      },
      description: 'Exchange code created'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Missing session token'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid session token'
    }
  }
})
