/**
 * Cross-cutting handling when the Techoo session is actually dead.
 * Only `/api/token` 401/403 (session token rejected) should emit this.
 * API 401s from JWT expiry or Google OAuth must refresh and retry first;
 * they must not notify here or the user is bounced to sign-in spuriously.
 */
export const SESSION_INVALID_REASON = {
  API_UNAUTHORIZED: 'api-unauthorized',
  TOKEN_EXCHANGE_FAILED: 'token-exchange-failed',
  SESSION_CHECK_FAILED: 'session-check-failed'
} as const

export type SessionInvalidReason =
  (typeof SESSION_INVALID_REASON)[keyof typeof SESSION_INVALID_REASON]

export interface SessionInvalidatedDetail {
  reason: SessionInvalidReason
}

type Listener = (detail: SessionInvalidatedDetail) => void

const listeners = new Set<Listener>()

export function onAuthSessionInvalidated(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyAuthSessionInvalidated(reason: SessionInvalidReason): void {
  const detail: SessionInvalidatedDetail = { reason }
  for (const fn of [...listeners]) {
    fn(detail)
  }
}
