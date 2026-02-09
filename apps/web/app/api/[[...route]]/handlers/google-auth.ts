import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  getGoogleAuthUrlRoute,
  googleAuthCallbackRoute,
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute
} from '../routes/google-auth'
import { getDb } from '../../../core/common.db'
import { formatTimestamp } from '../../../core/common.core'
import {
  getOAuthToken,
  upsertOAuthToken,
  deleteOAuthToken
} from '../../../core/oauth.db'
import { deleteAllCalendarsForProvider } from '../../../core/calendars.db'
import { googleCalendarProvider } from '../../../core/calendar-providers/google.service'

// GET /auth/google - Get authorization URL
export const getGoogleAuthUrlHandler: RouteHandler<
  typeof getGoogleAuthUrlRoute,
  AppBindings
> = async (c) => {
  try {
    const authUrl = googleCalendarProvider.getAuthUrl()
    return c.json({ authUrl }, 200)
  } catch (error) {
    console.error('Error generating Google auth URL:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate authorization URL'
    return c.json({ error: errorMessage }, 500)
  }
}

// GET /auth/google/callback - OAuth callback
export const googleAuthCallbackHandler: RouteHandler<
  typeof googleAuthCallbackRoute,
  AppBindings
> = async (c) => {
  try {
    const { code, error: oauthError } = c.req.valid('query')

    if (oauthError) {
      return c.json({ error: `OAuth error: ${oauthError}` }, 400)
    }

    if (!code) {
      return c.json({ error: 'No authorization code provided' }, 400)
    }

    const db = getDb()
    const user = c.get('user')

    // Exchange code for tokens
    const tokens = await googleCalendarProvider.exchangeCodeForTokens(code)

    // Store tokens in database
    await upsertOAuthToken(db, {
      userId: user.id,
      providerType: 'google',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly'
    })

    return c.json(
      {
        connected: true,
        providerType: 'google' as const,
        expiresAt: formatTimestamp(tokens.expiresAt)
      },
      200
    )
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return c.json({ error: 'Failed to exchange authorization code' }, 500)
  }
}

// GET /auth/google/status - Check OAuth status
export const getGoogleAuthStatusHandler: RouteHandler<
  typeof getGoogleAuthStatusRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')

    const token = await getOAuthToken(db, user.id, 'google')

    if (!token) {
      return c.json({ connected: false }, 200)
    }

    const now = Math.floor(Date.now() / 1000)
    const isExpired = token.expiresAt <= now

    return c.json(
      {
        connected: !isExpired,
        providerType: 'google' as const,
        expiresAt: formatTimestamp(token.expiresAt)
      },
      200
    )
  } catch (error) {
    console.error('Error checking Google OAuth status:', error)
    return c.json({ error: 'Failed to check OAuth status' }, 500)
  }
}

// DELETE /auth/google - Disconnect Google OAuth
export const deleteGoogleAuthHandler: RouteHandler<
  typeof deleteGoogleAuthRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')

    const token = await getOAuthToken(db, user.id, 'google')

    if (!token) {
      return c.json({ error: 'No Google OAuth connection found' }, 404)
    }

    // Try to revoke the token (ignore errors as it may already be invalid)
    try {
      await googleCalendarProvider.revokeToken(token.accessToken)
    } catch (revokeError) {
      console.warn('Failed to revoke Google token (may already be invalid):', revokeError)
    }

    // Delete all calendars for this provider (cascades to events)
    await deleteAllCalendarsForProvider(db, user.id, 'google')

    // Delete the OAuth token
    await deleteOAuthToken(db, user.id, 'google')

    return c.json(
      {
        success: true,
        message: 'Google OAuth disconnected successfully'
      },
      200
    )
  } catch (error) {
    console.error('Error disconnecting Google OAuth:', error)
    return c.json({ error: 'Failed to disconnect Google OAuth' }, 500)
  }
}
