import type { ProviderType } from '../oauth.core'

// Provider calendar representation (from Google, Outlook, etc.)
export interface ProviderCalendar {
  providerCalendarId: string
  name: string
  color?: string
  isPrimary?: boolean
}

// Provider event representation (from Google, Outlook, etc.)
export interface ProviderEvent {
  providerEventId: string
  title: string
  description?: string
  startAt: Date
  endAt: Date
  isAllDay: boolean
  location?: string
}

// OAuth tokens needed for provider API calls
export interface ProviderTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

// Token refresh result
export interface RefreshedTokens {
  accessToken: string
  refreshToken?: string // Some providers return a new refresh token
  expiresAt: Date
}

// Watch channel creation result
export interface WatchChannelResult {
  channelId: string
  resourceId: string
  expiresAt: Date
}

// Watch channel info for stopping
export interface WatchChannelInfo {
  channelId: string
  resourceId: string
}

// Calendar provider interface
export interface CalendarProvider {
  providerType: ProviderType

  // OAuth methods
  getAuthUrl(state?: string): string
  exchangeCodeForTokens(code: string): Promise<ProviderTokens>
  refreshAccessToken(refreshToken: string): Promise<RefreshedTokens>
  revokeToken(accessToken: string): Promise<void>

  // Calendar methods
  listCalendars(tokens: ProviderTokens): Promise<ProviderCalendar[]>

  // Event methods
  listEvents(
    tokens: ProviderTokens,
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderEvent[]>

  // Optional user info (email, profile)
  getUserInfo?(
    tokens: ProviderTokens
  ): Promise<{ email?: string; name?: string; picture?: string }>

  // Watch methods (push notifications)
  watchCalendar?(
    tokens: ProviderTokens,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    token?: string
  ): Promise<WatchChannelResult>

  stopWatching?(
    tokens: ProviderTokens,
    channel: WatchChannelInfo
  ): Promise<void>
}
