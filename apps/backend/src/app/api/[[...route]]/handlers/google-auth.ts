import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute,
  listGoogleAccountsRoute
} from '../routes/google-auth'
import { getDb } from '../../../core/common.db'
import {
  getOAuthTokenForAccount,
  listOAuthAccountRecords,
  listOAuthAccounts
} from '../../../core/oauth.db'
import { deleteAllCalendarsForProvider } from '../../../core/calendars.db'
import { googleCalendarProvider } from '../../../core/calendar-providers/google.service'
import { formatTimestamp } from '../../../core/common.core'

// GET /auth/google/status - Check if user has Google OAuth connected via better-auth
export const getGoogleAuthStatusHandler: RouteHandler<
  typeof getGoogleAuthStatusRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')
    const { accountId } = c.req.valid('query')

    // Check accounts table (populated by better-auth when user signs in with Google)
    if (accountId) {
      const account = await getOAuthTokenForAccount(
        db,
        user.id,
        'google',
        accountId
      )

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
    }

    const accounts = await listOAuthAccountRecords(db, user.id, 'google')
    const now = Date.now()
    const hasValid = accounts.some((account) => {
      if (!account.accessToken) return false
      if (!account.accessTokenExpiresAt) return true
      return account.accessTokenExpiresAt.getTime() > now
    })

    return c.json(
      {
        connected: hasValid,
        providerType: accounts.length ? ('google' as const) : undefined,
        expiresAt: null
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
    const { accountId } = c.req.valid('query')

    if (accountId) {
      const account = await getOAuthTokenForAccount(
        db,
        user.id,
        'google',
        accountId
      )

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

      // Delete all calendars for this provider/account (cascades to events)
      await deleteAllCalendarsForProvider(db, user.id, 'google', accountId)

      // Note: We don't delete the account record here because it's managed by better-auth.
      // The user can unlink their Google account through better-auth's unlinkAccount method.

      return c.json(
        {
          success: true,
          message: 'Google Calendar data disconnected successfully'
        },
        200
      )
    }

    const accounts = await listOAuthAccountRecords(db, user.id, 'google')
    if (!accounts.length) {
      return c.json({ error: 'No Google OAuth connection found' }, 404)
    }

    for (const account of accounts) {
      if (!account.accessToken) continue
      try {
        await googleCalendarProvider.revokeToken(account.accessToken)
      } catch (revokeError) {
        console.warn('Failed to revoke Google token (may already be invalid):', revokeError)
      }
    }

    await deleteAllCalendarsForProvider(db, user.id, 'google')

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

// GET /oauth/google/accounts - List linked Google OAuth accounts
export const listGoogleAccountsHandler: RouteHandler<
  typeof listGoogleAccountsRoute,
  AppBindings
> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')

    const accounts = await listOAuthAccounts(db, user.id, 'google')

    return c.json({ accounts }, 200)
  } catch (error) {
    console.error('Error listing Google OAuth accounts:', error)
    return c.json({ error: 'Failed to list OAuth accounts' }, 500)
  }
}
