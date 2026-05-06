import { Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { isApiRequestError } from '@/lib/api/ApiRequestError'
import { isApiDebugEnabled } from '@/lib/apiDebug'

/** Dedupes parallel requests / SWR paths that surface the same failure more than once. */
let lastReportKey = ''
let lastReportAt = 0
const REPORT_DEDUPE_MS = 2500

function reportDedupeSignature(err: unknown): string {
  if (isApiRequestError(err)) return `s:${err.status}`
  if (err instanceof Error && err.message === 'Unauthorized') return 'unauth'
  if (err instanceof Error) return `m:${err.message.slice(0, 120)}`
  return 'x'
}

/**
 * Shows one alert per unique failure within {@link REPORT_DEDUPE_MS} (burst-safe for parallel hooks).
 * Called from `customInstance` so failures are visible even when a promise is not awaited.
 */
export function reportApiFailure(err: unknown, title = 'Couldn’t complete request'): void {
  const key = `${title}|${reportDedupeSignature(err)}`
  const now = Date.now()
  if (key === lastReportKey && now - lastReportAt < REPORT_DEDUPE_MS) return
  lastReportKey = key
  lastReportAt = now
  showApiError(err, title)
}

const DEBUG_BODY_MAX = 6000

function withDebugDetail(err: unknown, userMessage: string): string {
  if (!isApiDebugEnabled()) return userMessage
  const lines = [userMessage, '', '--- Debug ---']
  if (isApiRequestError(err)) {
    lines.push(`HTTP ${err.status}`)
    const b = err.body
    lines.push(b && b.length > 0 ? b.slice(0, DEBUG_BODY_MAX) : '(empty body)')
  } else if (err instanceof Error) {
    lines.push(`${err.name}: ${err.message}`)
    if (err.stack) {
      lines.push(err.stack.slice(0, DEBUG_BODY_MAX))
    }
  } else {
    try {
      lines.push(JSON.stringify(err, null, 2).slice(0, DEBUG_BODY_MAX))
    } catch {
      lines.push(String(err))
    }
  }
  return lines.join('\n')
}

function messageForHttpStatus(status: number): string {
  switch (status) {
    case 400:
      return 'This request could not be processed. Check what you entered and try again.'
    case 401:
      return 'You need to sign in again to continue.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'That item was not found. It may have been deleted elsewhere.'
    case 409:
      return 'That action conflicts with the latest data. Refresh and try again.'
    case 422:
      return 'Some of the information could not be saved. Check your input and try again.'
    case 429:
      return 'Too many requests. Please wait a moment and try again.'
    case 502:
    case 503:
    case 504:
      return 'The service is temporarily unavailable. Please try again in a little while.'
    default:
      if (status >= 500) {
        return 'Something went wrong on the server. Please try again later.'
      }
      if (status >= 400) {
        return 'The request could not be completed. Please try again.'
      }
      return 'Something went wrong. Please try again.'
  }
}

/** Parses legacy errors from `HTTP <code>: …` strings (e.g. older code paths). */
function statusFromErrorMessage(message: string): number | null {
  const m = /^HTTP (\d{3})\b/.exec(message)
  if (!m) return null
  return Number(m[1])
}

function messageFromUnknown(err: unknown): string {
  if (err instanceof Error) {
    if (isApiRequestError(err)) {
      return messageForHttpStatus(err.status)
    }
    const fromLegacy = statusFromErrorMessage(err.message)
    if (fromLegacy != null) return messageForHttpStatus(fromLegacy)
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

function showErrorAlert(alertTitle: string, body: string): void {
  Alert.alert(alertTitle, body, [
    {
      text: 'Copy',
      onPress: () => {
        void Clipboard.setStringAsync(body)
      },
    },
    { text: 'OK', style: 'cancel' },
  ])
}

/**
 * Shows a native alert for API failures from `customInstance` / generated clients.
 * Call after rolling back optimistic updates; may rethrow so callers can fix local UI state.
 */
export function showApiError(err: unknown, title = 'Couldn’t complete request'): void {
  if (err instanceof Error && err.message === 'Unauthorized') {
    const sessionMsg = 'Your session is no longer valid. Please sign in again.'
    showErrorAlert('Session expired', withDebugDetail(err, sessionMsg))
    return
  }
  if (isApiRequestError(err)) {
    showErrorAlert(title, withDebugDetail(err, messageForHttpStatus(err.status)))
    return
  }
  const message =
    err instanceof Error ? messageFromUnknown(err) : 'Something went wrong. Please try again.'
  showErrorAlert(title, withDebugDetail(err, message))
}
