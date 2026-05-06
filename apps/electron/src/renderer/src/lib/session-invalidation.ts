/**
 * Cross-cutting handling when remote auth is rejected or tokens cannot be refreshed.
 * API transport (`customInstance`) and auth/token helpers emit here; hooks subscribe to
 * sync React auth UI without scattering listeners across generated API clients.
 */
export type SessionInvalidReason =
  | 'api-unauthorized'
  | 'token-exchange-failed'
  | 'session-check-failed'

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
