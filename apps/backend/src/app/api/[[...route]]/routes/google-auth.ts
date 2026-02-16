import { createRoute } from '@hono/zod-openapi'
import {
  OAuthStatusResponseModel,
  OAuthDisconnectResponseModel
} from '../../../core/oauth.core'
import { ErrorResponseModel } from '../../../core/common.core'

// Note: Google OAuth authentication is now handled by better-auth.
// Users sign in with Google via better-auth's /api/auth/callback/google endpoint.
// These routes are for checking status and managing calendar data.

// GET /oauth/google/status - Check OAuth status
export const getGoogleAuthStatusRoute = createRoute({
  method: 'get',
  path: '/oauth/google/status',
  summary: 'Check Google OAuth status',
  description: 'Check if the user has a valid Google OAuth connection (via better-auth)',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OAuthStatusResponseModel
        }
      },
      description: 'OAuth status retrieved successfully'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to check OAuth status'
    }
  }
})

// DELETE /oauth/google - Disconnect Google OAuth
export const deleteGoogleAuthRoute = createRoute({
  method: 'delete',
  path: '/oauth/google',
  summary: 'Disconnect Google Calendar data',
  description: 'Removes all calendar data associated with the Google account. Note: To fully unlink the Google account, use better-auth unlinkAccount.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OAuthDisconnectResponseModel
        }
      },
      description: 'Google Calendar data disconnected successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'No Google OAuth connection found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to disconnect Google OAuth'
    }
  }
})
