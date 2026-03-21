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

    console.log('Received Google Calendar webhook:', {
      channelId,
      resourceId,
      resourceState,
      channelToken
    })

    // Validate required headers
    if (!channelId || !resourceId) {
      console.warn('Missing required webhook headers')
      return c.json({}, 400)
    }

    // Handle sync messages (initial confirmation)
    if (resourceState === 'sync') {
      console.log('Received sync notification for channel:', channelId)
      return c.json({}, 200)
    }

    // Handle exists/update messages (actual changes)
    if (resourceState !== 'exists') {
      console.log('Unknown resource state:', resourceState)
      return c.json({}, 200)
    }

    // Channel token format: "user-{id}:{uuid}" — extract user ID
    const tenantPart = channelToken?.split(':')[0]
    const userIdMatch = tenantPart?.match(/^user-(\d+)$/)
    const tenantUserId = userIdMatch ? parseInt(userIdMatch[1], 10) : NaN
    if (!tenantPart || isNaN(tenantUserId)) {
      console.warn('Missing or invalid tenant in channel token:', channelToken)
      return c.json({}, 200)
    }
    const db = getTenantDbForUser(tenantUserId)
    const oauth = createOAuthService(tenantUserId)

    // Find the watch channel
    const watchChannel = await getWatchChannelByChannelId(db, channelId)
    if (!watchChannel) {
      console.warn('Watch channel not found:', channelId)
      return c.json({}, 200) // Return 200 to prevent retries
    }

    // Verify token if set
    if (watchChannel.token && watchChannel.token !== channelToken) {
      console.warn('Token mismatch for channel:', channelId)
      return c.json({}, 200) // Return 200 to prevent retries
    }

    // Get the calendar
    const calendar = await getCalendarByIdOnly(db, watchChannel.calendarId)
    if (!calendar) {
      console.warn(
        'Calendar not found for watch channel:',
        watchChannel.calendarId
      )
      return c.json({}, 200)
    }

    // Get user ID from calendar (stored as string in API model)
    const userId = parseInt(calendar.userId, 10)
    if (isNaN(userId)) {
      console.warn('Invalid user ID for calendar:', calendar.id)
      return c.json({}, 200)
    }

    // Get OAuth tokens from accounts table (populated by better-auth)
    const account = await oauth.getTokenForAccount(
      'google',
      calendar.providerAccountId
    )
    if (!account || !account.accessToken) {
      console.warn('Google account not found for user:', userId)
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

      console.log(
        `Webhook sync completed for calendar ${calendar.id}: ${eventsCount} events`
      )
    } catch (syncError) {
      console.error('Error syncing calendar from webhook:', syncError)
      // Still return 200 to prevent retries
    }

    return c.json({}, 200)
  } catch (error) {
    console.error('Error handling Google Calendar webhook:', error)
    // Return 200 to prevent Google from retrying
    return c.json({}, 200)
  }
}
