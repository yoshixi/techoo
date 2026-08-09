/**
 * Maps Google Calendar / OAuth errors to actionable API responses.
 * Pure: no I/O — safe to unit test with plain Error strings.
 */

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
] as const

export type GoogleCalendarApiError = {
  status: 401 | 403 | 500
  error: string
  code: string
}

export function hasGoogleCalendarScope(scope: string | null | undefined): boolean {
  if (!scope) return false
  const granted = scope.split(/[\s,]+/).filter(Boolean)
  return GOOGLE_CALENDAR_SCOPES.some((required) => granted.includes(required))
}

export function mapGoogleCalendarError(error: unknown): GoogleCalendarApiError {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('failed to refresh') ||
    lower.includes('invalid_grant') ||
    lower.includes('token expired or invalid')
  ) {
    return {
      status: 401,
      error: 'Google session expired; re-link your Google account.',
      code: 'GOOGLE_TOKEN_EXPIRED'
    }
  }

  if (
    lower.includes('accessnotconfigured') ||
    lower.includes('has not been used') ||
    lower.includes('is disabled') ||
    (lower.includes('calendar api') &&
      (lower.includes('disabled') || lower.includes('not been used')))
  ) {
    return {
      status: 403,
      error:
        'Google Calendar API is not enabled for this project. Enable it in Google Cloud Console, then try again.',
      code: 'GOOGLE_CALENDAR_API_DISABLED'
    }
  }

  if (
    lower.includes('insufficient') ||
    lower.includes('access_denied') ||
    lower.includes('insufficientpermissions')
  ) {
    return {
      status: 403,
      error: 'Re-link your Google account to grant Calendar access.',
      code: 'GOOGLE_CALENDAR_SCOPE_MISSING'
    }
  }

  if (lower.includes('401') || lower.includes('unauthorized')) {
    return {
      status: 401,
      error: 'Google session expired; re-link your Google account.',
      code: 'GOOGLE_TOKEN_EXPIRED'
    }
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return {
      status: 403,
      error:
        'Google Calendar access was denied. Re-link your Google account, or enable the Calendar API in Google Cloud Console.',
      code: 'GOOGLE_CALENDAR_FORBIDDEN'
    }
  }

  return {
    status: 500,
    error: 'Failed to retrieve available calendars from Google.',
    code: 'GOOGLE_CALENDAR_ERROR'
  }
}
