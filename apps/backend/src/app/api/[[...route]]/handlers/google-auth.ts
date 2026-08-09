import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute,
  listGoogleAccountsRoute
} from '../routes/google-auth'
import { deleteAllCalendarsForProvider } from '../../../core/calendars.db'
import {
  googleCalendarProvider,
  getValidGoogleTokens
} from '../../../core/calendar-providers/google.service'
import { hasGoogleCalendarScope } from '../../../core/calendar-providers/google-errors'
import { formatTimestamp } from '../../../core/common.core'
import type { OAuthService } from '../../../core/oauth.service'
import type { ProviderTokens } from '../../../core/calendar-providers/types'

async function refreshAccountTokensIfNeeded(
  oauth: OAuthService,
  providerAccountId: string,
  account: {
    accessToken: string | null
    refreshToken: string | null
    accessTokenExpiresAt: Date | null
    scope: string | null
  }
): Promise<{
  connected: boolean
  expiresAt: Date | null
  scope: string | null
}> {
  if (!account.accessToken) {
    return { connected: false, expiresAt: null, scope: account.scope }
  }

  const providerTokens: ProviderTokens = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken || '',
    expiresAt: account.accessTokenExpiresAt || new Date(0)
  }

  try {
    const validTokens = await getValidGoogleTokens(providerTokens)
    if (validTokens.accessToken !== account.accessToken) {
      await oauth.updateToken('google', providerAccountId, {
        accessToken: validTokens.accessToken,
        refreshToken: validTokens.refreshToken,
        expiresAt: validTokens.expiresAt
      })
    }
    return {
      connected: true,
      expiresAt: validTokens.expiresAt,
      scope: account.scope
    }
  } catch {
    return {
      connected: false,
      expiresAt: account.accessTokenExpiresAt,
      scope: account.scope
    }
  }
}

// GET /oauth/google/status - Check if user has Google OAuth connected via better-auth
export const getGoogleAuthStatusHandler: RouteHandler<
  typeof getGoogleAuthStatusRoute,
  AppBindings
> = async (c) => {
  try {
    const oauth = c.get('oauth')
    const { accountId } = c.req.valid('query')

    if (accountId) {
      const account = await oauth.getTokenForAccount('google', accountId)

      if (!account || !account.accessToken) {
        return c.json(
          {
            connected: false,
            scope: account?.scope ?? null,
            hasCalendarScope: hasGoogleCalendarScope(account?.scope)
          },
          200
        )
      }

      const refreshed = await refreshAccountTokensIfNeeded(
        oauth,
        accountId,
        account
      )

      return c.json(
        {
          connected: refreshed.connected,
          providerType: 'google' as const,
          expiresAt: refreshed.expiresAt
            ? formatTimestamp(refreshed.expiresAt)
            : null,
          scope: refreshed.scope,
          hasCalendarScope: hasGoogleCalendarScope(refreshed.scope)
        },
        200
      )
    }

    const accounts = await oauth.listAccountRecords('google')
    let connected = false
    let scope: string | null = null

    for (const account of accounts) {
      if (!account.accessToken || !account.accountId) continue
      const refreshed = await refreshAccountTokensIfNeeded(
        oauth,
        account.accountId,
        account
      )
      if (!scope && refreshed.scope) scope = refreshed.scope
      if (refreshed.connected) {
        connected = true
        scope = refreshed.scope
        break
      }
    }

    return c.json(
      {
        connected,
        providerType: accounts.length ? ('google' as const) : undefined,
        expiresAt: null,
        scope,
        hasCalendarScope: hasGoogleCalendarScope(scope)
      },
      200
    )
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to check google oauth status')
    return c.json({ error: 'Failed to check OAuth status' }, 500)
  }
}

// DELETE /oauth/google - Disconnect Google OAuth and remove calendar data
// Note: This only removes calendar data. To fully unlink the account,
// use better-auth's unlinkAccount method from the client.
export const deleteGoogleAuthHandler: RouteHandler<
  typeof deleteGoogleAuthRoute,
  AppBindings
> = async (c) => {
  try {
    const oauth = c.get('oauth')
    const db = c.get('db')
    const user = c.get('user')
    const { accountId } = c.req.valid('query')

    if (accountId) {
      const account = await oauth.getTokenForAccount('google', accountId)

      if (!account) {
        return c.json({ error: 'No Google OAuth connection found' }, 404)
      }

      // Try to revoke the token (ignore errors as it may already be invalid)
      if (account.accessToken) {
        try {
          await googleCalendarProvider.revokeToken(account.accessToken)
        } catch (revokeError) {
          c.get('logger').warn({ err: revokeError }, 'failed to revoke google token, may already be invalid')
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

    const accounts = await oauth.listAccountRecords('google')
    if (!accounts.length) {
      return c.json({ error: 'No Google OAuth connection found' }, 404)
    }

    for (const account of accounts) {
      if (!account.accessToken) continue
      try {
        await googleCalendarProvider.revokeToken(account.accessToken)
      } catch (revokeError) {
        c.get('logger').warn({ err: revokeError }, 'failed to revoke google token, may already be invalid')
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
    c.get('logger').error({ err: error }, 'failed to disconnect google oauth')
    return c.json({ error: 'Failed to disconnect Google OAuth' }, 500)
  }
}

// GET /oauth/google/accounts - List linked Google OAuth accounts
export const listGoogleAccountsHandler: RouteHandler<
  typeof listGoogleAccountsRoute,
  AppBindings
> = async (c) => {
  try {
    const oauth = c.get('oauth')

    const accounts = await oauth.listAccounts('google')

    return c.json({ accounts }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to list google oauth accounts')
    return c.json({ error: 'Failed to list OAuth accounts' }, 500)
  }
}
