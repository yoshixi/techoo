import { describe, expect, it } from 'vitest'
import {
  hasGoogleCalendarScope,
  mapGoogleCalendarError
} from './google-errors'

describe('hasGoogleCalendarScope', () => {
  it('returns true when calendar.readonly is granted', () => {
    expect(
      hasGoogleCalendarScope(
        'openid email https://www.googleapis.com/auth/calendar.readonly'
      )
    ).toBe(true)
  })

  it('returns false when calendar scopes are missing', () => {
    expect(hasGoogleCalendarScope('openid email profile')).toBe(false)
  })

  it('returns false for empty scope', () => {
    expect(hasGoogleCalendarScope(null)).toBe(false)
    expect(hasGoogleCalendarScope('')).toBe(false)
  })
})

describe('mapGoogleCalendarError', () => {
  it('maps refresh failures to re-link guidance', () => {
    expect(
      mapGoogleCalendarError(
        new Error('Failed to refresh Google access token: 400 invalid_grant')
      )
    ).toEqual({
      status: 401,
      error: 'Google session expired; re-link your Google account.',
      code: 'GOOGLE_TOKEN_EXPIRED'
    })
  })

  it('maps Calendar API disabled to Cloud Console guidance', () => {
    expect(
      mapGoogleCalendarError(
        new Error(
          'Failed to list Google calendars: 403 Google Calendar API has not been used in project 123 before or it is disabled.'
        )
      )
    ).toEqual({
      status: 403,
      error:
        'Google Calendar API is not enabled for this project. Enable it in Google Cloud Console, then try again.',
      code: 'GOOGLE_CALENDAR_API_DISABLED'
    })
  })

  it('maps insufficient scopes to re-link for calendar access', () => {
    expect(
      mapGoogleCalendarError(
        new Error(
          'Failed to list Google calendars: 403 Request had insufficient authentication scopes.'
        )
      )
    ).toEqual({
      status: 403,
      error: 'Re-link your Google account to grant Calendar access.',
      code: 'GOOGLE_CALENDAR_SCOPE_MISSING'
    })
  })
})
