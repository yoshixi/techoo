import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute
} from '../routes/google-auth'
import { getDb } from '../../../core/common.db'
import { formatTimestamp } from '../../../core/common.core'
import { getOAuthToken } from '../../../core/oauth.db'
import { deleteAllCalendarsForProvider } from '../../../core/calendars.db'
import { googleCalendarProvider } from '../../../core/calendar-providers/google.service'

// GET /auth/google/status - Check if user has Google OAuth connected via better-auth
export const getGoogleAuthStatusHandler: RouteHandler<
  typeof getGoogleAuthStatusRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')

    // Check accounts table (populated by better-auth when user signs in with Google)
    const account = await getOAuthToken(db, user.id, 'google')

    if (!account || !account.accessToken) {
      return c.json({ connected: false }, 200)
    }

    // Check if token is expired (if expiry is set)
    let isExpired = false
    if (account.accessTokenExpiresAt) {
      const now = Date.now()
      isExpired = account.accessTokenExpiresAt.getTime() <= now
    }

    return c.json(
      {
        connected: !isExpired,
        providerType: 'google' as const,
        expiresAt: account.accessTokenExpiresAt
          ? formatTimestamp(account.accessTokenExpiresAt)
          : null
      },
      200
    )
  } catch (error) {
    console.error('Error checking Google OAuth status:', error)
    return c.json({ error: 'Failed to check OAuth status' }, 500)
  }
}

// DELETE /auth/google - Disconnect Google OAuth and remove calendar data
// Note: This only removes calendar data. To fully unlink the account,
// use better-auth's unlinkAccount method from the client.
export const deleteGoogleAuthHandler: RouteHandler<
  typeof deleteGoogleAuthRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')

    const account = await getOAuthToken(db, user.id, 'google')

    if (!account) {
      return c.json({ error: 'No Google OAuth connection found' }, 404)
    }

    // Try to revoke the token (ignore errors as it may already be invalid)
    if (account.accessToken) {
      try {
        await googleCalendarProvider.revokeToken(account.accessToken)
      } catch (revokeError) {
        console.warn('Failed to revoke Google token (may already be invalid):', revokeError)
      }
    }

    // Delete all calendars for this provider (cascades to events)
    await deleteAllCalendarsForProvider(db, user.id, 'google')

    // Note: We don't delete the account record here because it's managed by better-auth.
    // The user can unlink their Google account through better-auth's unlinkAccount method.

    return c.json(
      {
        success: true,
        message: 'Google Calendar data disconnected successfully'
      },
      200
    )
  } catch (error) {
    console.error('Error disconnecting Google OAuth:', error)
    return c.json({ error: 'Failed to disconnect Google OAuth' }, 500)
  }
}
