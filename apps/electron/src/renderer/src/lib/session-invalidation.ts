/**
 * Cross-cutting handling when remote auth is rejected or tokens cannot be refreshed.
 * API transport (`customInstance`) and auth/token helpers emit here; hooks subscribe to
 * sync React auth UI without scattering listeners across generated API clients.
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
