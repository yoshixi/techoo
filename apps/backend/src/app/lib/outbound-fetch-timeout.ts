/**
 * libsql's HTTP client calls `globalThis.fetch` for Turso. If that request never
 * settles, the Worker isolate never returns a Response and Cloudflare reports:
 * "Hung and would never generate a response".
 *
 * We install a shallow timeout around outbound fetches once per isolate, so
 * stalled DB calls reject instead of hanging forever.
 */
let installed = false

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const any = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any
  if (typeof any === 'function') {
    return any([a, b])
  }

  const ctrl = new AbortController()
  const abort = (): void => {
    if (!ctrl.signal.aborted) ctrl.abort()
  }
  if (a.aborted || b.aborted) {
    abort()
  } else {
    a.addEventListener('abort', abort, { once: true })
    b.addEventListener('abort', abort, { once: true })
  }
  return ctrl.signal
}

export function installOutboundFetchDeadlineOnce(): void {
  if (installed) return
  const raw = typeof process !== 'undefined' ? process.env.TURSO_HTTP_TIMEOUT_MS : undefined
  if (raw === '0') return

  const ms = raw !== undefined && raw !== '' ? Number(raw) : 20_000
  if (!Number.isFinite(ms) || ms <= 0) return

  installed = true
  const original = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const timeoutSignal = AbortSignal.timeout(ms)
    const merged =
      init?.signal != null ? combineSignals(init.signal, timeoutSignal) : timeoutSignal

    return original(input, {
      ...init,
      signal: merged,
    })
  }
}
