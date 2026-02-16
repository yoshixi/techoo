import { google } from 'googleapis'
import type {
  CalendarProvider,
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  RefreshedTokens,
  WatchChannelResult,
  WatchChannelInfo
} from './types'

// Google Calendar scopes
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
]

// Get OAuth2 client configuration
function getOAuth2Config() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth configuration. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.'
    )
  }

  return { clientId, clientSecret, redirectUri }
}

// Create OAuth2 client
function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuth2Config()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// Google Calendar Provider implementation
export const googleCalendarProvider: CalendarProvider = {
  providerType: 'google',

  // Generate authorization URL for OAuth flow
  getAuthUrl(state?: string): string {
    const oauth2Client = createOAuth2Client()

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state
    })
  },

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<ProviderTokens> {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain tokens from Google')
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    }
  },

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      throw new Error('Failed to refresh Google access token')
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || undefined,
      expiresAt
    }
  },

  // Revoke access token
  async revokeToken(accessToken: string): Promise<void> {
    const oauth2Client = createOAuth2Client()
    await oauth2Client.revokeToken(accessToken)
  },

  // List user's calendars
  async listCalendars(tokens: ProviderTokens): Promise<ProviderCalendar[]> {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const response = await calendar.calendarList.list()

    const calendars: ProviderCalendar[] = (response.data.items || []).map(
      (item) => ({
        providerCalendarId: item.id || '',
        name: item.summary || 'Untitled Calendar',
        color: item.backgroundColor || undefined,
        isPrimary: item.primary || false
      })
    )

    return calendars
  },

  // List events from a calendar
  async listEvents(
    tokens: ProviderTokens,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderEvent[]> {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    })

    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })

    const events: ProviderEvent[] = []
    let pageToken: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
      // Fetch a page of events
      const fetchPage = async (token: string | undefined) => {
        return calendarApi.events.list({
          calendarId,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true, // Expand recurring events
          orderBy: 'startTime',
          maxResults: 250,
          pageToken: token
        })
      }
      const response = await fetchPage(pageToken)

      const items = response.data.items || []
      for (const item of items) {
        if (!item.id) continue

        // Determine if all-day event
        const isAllDay = !item.start?.dateTime

        // Parse start and end times
        let startAt: Date
        let endAt: Date

        if (isAllDay) {
          // All-day event: date is in YYYY-MM-DD format
          startAt = new Date(item.start?.date || '')
          endAt = new Date(item.end?.date || '')
        } else {
          // Timed event
          startAt = new Date(item.start?.dateTime || '')
          endAt = new Date(item.end?.dateTime || '')
        }

        events.push({
          providerEventId: item.id,
          title: item.summary || 'Untitled Event',
          description: item.description || undefined,
          startAt,
          endAt,
          isAllDay,
          location: item.location || undefined
        })
      }

      pageToken = response.data.nextPageToken || undefined
      hasMore = !!pageToken
    }

    return events
  },

  // Watch a calendar for changes (push notifications)
  async watchCalendar(
    tokens: ProviderTokens,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    token?: string
  ): Promise<WatchChannelResult> {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    })

    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })

    // Set expiration to 7 days from now (maximum allowed by Google)
    const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000

    const response = await calendarApi.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: token,
        expiration: String(expirationMs)
      }
    })

    if (!response.data.resourceId) {
      throw new Error('Failed to create watch channel: no resourceId returned')
    }

    return {
      channelId: response.data.id || channelId,
      resourceId: response.data.resourceId,
      expiresAt: response.data.expiration
        ? new Date(Number(response.data.expiration))
        : new Date(expirationMs)
    }
  },

  // Stop watching a calendar
  async stopWatching(
    tokens: ProviderTokens,
    channel: WatchChannelInfo
  ): Promise<void> {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    })

    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })

    await calendarApi.channels.stop({
      requestBody: {
        id: channel.channelId,
        resourceId: channel.resourceId
      }
    })
  }
}

// Helper function to get valid tokens, refreshing if necessary
export async function getValidGoogleTokens(
  tokens: ProviderTokens
): Promise<ProviderTokens> {
  const now = Date.now()
  const bufferSeconds = 300 // 5 minute buffer

  // If token is still valid (with buffer), return as is
  if (tokens.expiresAt.getTime() > now + bufferSeconds * 1000) {
    return tokens
  }

  // Token is expired or about to expire, refresh it
  const refreshed = await googleCalendarProvider.refreshAccessToken(
    tokens.refreshToken
  )

  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || tokens.refreshToken,
    expiresAt: refreshed.expiresAt
  }
}
