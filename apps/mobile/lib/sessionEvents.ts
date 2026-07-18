type Listener = () => void

const listeners = new Set<Listener>()

/** Subscribe to session invalidation (e.g. HTTP 401 after `clearAuthState`). */
export function subscribeSessionInvalidated(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Call after clearing stored credentials so React auth state and navigation update. */
export function notifySessionInvalidated(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // avoid breaking other listeners
    }
  }
}
