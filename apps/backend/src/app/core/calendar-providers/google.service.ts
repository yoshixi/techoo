import type {
  CalendarProvider,
  ProviderCalendar,
  ProviderEvent,
  ProviderTokens,
  RefreshedTokens,
  WatchChannelResult,
  WatchChannelInfo
} from './types'

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

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

const buildAuthUrl = (params: Record<string, string>) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

// Use direct REST calls because googleapis depends on Node http, which is not
// fully supported in the Cloudflare Workers runtime.
const authorizedFetch = async (url: string, accessToken: string, init?: RequestInit) =>
  fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })

// Google Calendar Provider implementation
export const googleCalendarProvider: CalendarProvider = {
  providerType: 'google',

  // Generate authorization URL for OAuth flow
  getAuthUrl(state?: string): string {
    const { clientId, redirectUri } = getOAuth2Config()

    return buildAuthUrl({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      scope: SCOPES.join(' '),
      prompt: 'consent',
      ...(state ? { state } : {})
    })
  },

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<ProviderTokens> {
    const { clientId, clientSecret, redirectUri } = getOAuth2Config()
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to exchange code for tokens: ${response.status} ${errorText}`.trim()
      )
    }

    const tokens = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain tokens from Google')
    }

    const expiresAt =
      tokens.expires_in !== undefined
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000)

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    }
  },

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
    const { clientId, clientSecret } = getOAuth2Config()
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to refresh Google access token: ${response.status} ${errorText}`.trim()
      )
    }

    const credentials = (await response.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }

    if (!credentials.access_token) {
      throw new Error('Failed to refresh Google access token')
    }

    const expiresAt =
      credentials.expires_in !== undefined
        ? new Date(Date.now() + credentials.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000)

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || undefined,
      expiresAt
    }
  },

  // Revoke access token
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(
      `${GOOGLE_OAUTH_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to revoke token: ${response.status} ${errorText}`.trim())
    }
  },

  // List user's calendars
  async listCalendars(tokens: ProviderTokens): Promise<ProviderCalendar[]> {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to list Google calendars: ${response.status} ${errorText}`.trim()
      )
    }

    const data = (await response.json()) as {
      items?: Array<{
        id?: string | null
        summary?: string | null
        backgroundColor?: string | null
        primary?: boolean | null
      }>
    }

    return (data.items || []).map((item) => ({
      providerCalendarId: item.id || '',
      name: item.summary || 'Untitled Calendar',
      color: item.backgroundColor || undefined,
      isPrimary: item.primary || false
    }))
  },

  // List events from a calendar
  async listEvents(
    tokens: ProviderTokens,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderEvent[]> {
    const events: ProviderEvent[] = []
    let pageToken: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const params = new URLSearchParams({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250'
      })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await authorizedFetch(
        `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        tokens.accessToken
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to list Google events: ${response.status} ${errorText}`.trim()
        )
      }

      const data = (await response.json()) as {
        items?: Array<{
          id?: string | null
          summary?: string | null
          description?: string | null
          start?: { dateTime?: string | null; date?: string | null }
          end?: { dateTime?: string | null; date?: string | null }
          location?: string | null
        }>
        nextPageToken?: string | null
      }

      const items = data.items || []
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

      pageToken = data.nextPageToken || undefined
      hasMore = !!pageToken
    }

    return events
  },

  // This is not part of the CalendarProvider interface but is used elsewhere.
  async getUserInfo(tokens: ProviderTokens): Promise<{ email?: string; name?: string; picture?: string }> {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Google user info: ${response.status}`)
    }

    const data = (await response.json()) as {
      email?: string
      name?: string
      picture?: string
    }

    return data
  },

  // Watch a calendar for changes (push notifications)
  async watchCalendar(
    tokens: ProviderTokens,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    token?: string
  ): Promise<WatchChannelResult> {
    // Set expiration to 7 days from now (maximum allowed by Google)
    const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000

    const response = await authorizedFetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      tokens.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: token,
          expiration: String(expirationMs)
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to watch Google calendar: ${response.status} ${errorText}`.trim()
      )
    }

    const data = (await response.json()) as {
      id?: string | null
      resourceId?: string | null
      expiration?: string | null
    }

    if (!data.resourceId) {
      throw new Error('Failed to create watch channel: no resourceId returned')
    }

    return {
      channelId: data.id || channelId,
      resourceId: data.resourceId,
      expiresAt: data.expiration
        ? new Date(Number(data.expiration))
        : new Date(expirationMs)
    }
  },

  // Stop watching a calendar
  async stopWatching(
    tokens: ProviderTokens,
    channel: WatchChannelInfo
  ): Promise<void> {
    const response = await authorizedFetch(
      `${GOOGLE_CALENDAR_API_BASE}/channels/stop`,
      tokens.accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          id: channel.channelId,
          resourceId: channel.resourceId
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to stop watch channel: ${response.status} ${errorText}`.trim()
      )
    }
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
