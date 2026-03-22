import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { googleCalendarWebhookRoute } from '../routes/webhooks'
import { getTenantDbForUser } from '../../../core/common.db'
import { getWatchChannelByChannelId } from '../../../core/watch-channels.db'
import {
  getCalendarByIdOnly,
  updateCalendarLastSynced
} from '../../../core/calendars.db'
import { importEventsForCalendar } from '../../../core/events.db'
import { createOAuthService } from '../../../core/oauth.service'
import {
  googleCalendarProvider,
  getValidGoogleTokens
} from '../../../core/calendar-providers/google.service'
import type { ProviderTokens } from '../../../core/calendar-providers/types'

// POST /webhooks/google-calendar - Handle Google Calendar push notifications
export const googleCalendarWebhookHandler: RouteHandler<
  typeof googleCalendarWebhookRoute,
  AppBindings
> = async (c) => {
  try {
    // Google sends these headers with notifications
    const channelId = c.req.header('X-Goog-Channel-ID')
    const resourceId = c.req.header('X-Goog-Resource-ID')
    const resourceState = c.req.header('X-Goog-Resource-State')
    const channelToken = c.req.header('X-Goog-Channel-Token')

    // Validate required headers
    if (!channelId || !resourceId) {
      c.get('logger').warn('missing required webhook headers')
      return c.json({}, 400)
    }

    const logger = c.get('logger').child({ channelId, resourceId, resourceState })

    logger.info('received google calendar webhook')

    // Handle sync messages (initial confirmation)
    if (resourceState === 'sync') {
      logger.info('received sync notification')
      return c.json({}, 200)
    }

    // Handle exists/update messages (actual changes)
    if (resourceState !== 'exists') {
      logger.info('unknown resource state')
      return c.json({}, 200)
    }

    // Channel token format: "{group}-user-{id}:{uuid}" — extract user ID
    const tenantPart = channelToken?.split(':')[0]
    const userIdMatch = tenantPart?.match(/-user-(\d+)$/)
    const tenantUserId = userIdMatch ? parseInt(userIdMatch[1], 10) : NaN
    if (!tenantPart || isNaN(tenantUserId)) {
      logger.warn({ channelToken }, 'missing or invalid tenant in channel token')
      return c.json({}, 200)
    }
    const db = getTenantDbForUser(tenantUserId)
    const oauth = createOAuthService(tenantUserId)

    // Find the watch channel
    const watchChannel = await getWatchChannelByChannelId(db, channelId)
    if (!watchChannel) {
      logger.warn('watch channel not found')
      return c.json({}, 200) // Return 200 to prevent retries
    }

    // Verify token if set
    if (watchChannel.token && watchChannel.token !== channelToken) {
      logger.warn('token mismatch for channel')
      return c.json({}, 200) // Return 200 to prevent retries
    }

    // Get the calendar
    const calendar = await getCalendarByIdOnly(db, watchChannel.calendarId)
    if (!calendar) {
      logger.warn(
        { watchChannelCalendarId: watchChannel.calendarId },
        'calendar not found for watch channel'
      )
      return c.json({}, 200)
    }

    // Get user ID from calendar (stored as string in API model)
    const userId = parseInt(calendar.userId, 10)
    if (isNaN(userId)) {
      logger.warn({ calendarId: calendar.id }, 'invalid user ID for calendar')
      return c.json({}, 200)
    }

    // Get OAuth tokens from accounts table (populated by better-auth)
    const account = await oauth.getTokenForAccount(
      'google',
      calendar.providerAccountId
    )
    if (!account || !account.accessToken) {
      logger.warn({ userId }, 'google account not found for user')
      return c.json({}, 200)
    }

    const providerTokens: ProviderTokens = {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken || '',
      expiresAt: account.accessTokenExpiresAt || new Date(0)
    }

    try {
      // Refresh tokens if needed
      const validTokens = await getValidGoogleTokens(providerTokens)

      // Update tokens if refreshed
      if (validTokens.accessToken !== account.accessToken) {
        await oauth.updateToken('google', calendar.providerAccountId, {
          accessToken: validTokens.accessToken,
          refreshToken: validTokens.refreshToken,
          expiresAt: validTokens.expiresAt
        })
      }

      // Fetch and import events (sync the calendar)
      const now = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)

      const events = await googleCalendarProvider.listEvents(
        validTokens,
        calendar.providerCalendarId,
        now,
        endDate
      )

      const calendarId = parseInt(calendar.id, 10)
      const eventsCount = await importEventsForCalendar(
        db,
        calendarId,
        'google',
        events
      )

      // Update last synced timestamp
      await updateCalendarLastSynced(db, calendarId)

      logger.info({ calendarId: calendar.id, eventsCount }, 'webhook sync completed')
    } catch (syncError) {
      logger.error({ err: syncError }, 'failed to sync calendar from webhook')
      // Still return 200 to prevent retries
    }

    return c.json({}, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to handle google calendar webhook')
    // Return 200 to prevent Google from retrying
    return c.json({}, 200)
  }
}
