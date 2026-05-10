/**
 * Rich, JSON-safe serialization for logs (Better Auth, Drizzle, Libsql errors).
 * Preserves error chains and common fields that plain JSON.stringify drops.
 */

const MAX_DEPTH = 10
const MAX_STRING_LEN = 4000

/** Property names whose values are never logged verbatim (passwords, OAuth material, etc.). */
const SENSITIVE_KEY =
  /^(password|client_?secret|code_?verifier|access_?token|refresh_?token|id_?token|authorization|cookie|api_?key|bearer(?:_token)?|jwt|secret|session_?secret|private_?key)$/i

export function summarizeMainDbUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('file:')) return 'file:***'
  try {
    const u = new URL(url.replace(/^libsql:/i, 'https:'))
    return u.host || url
  } catch {
    return 'invalid-url'
  }
}

function truncateString(s: string): string {
  return redactInlineSecrets(truncateRaw(s))
}

function truncateRaw(s: string): string {
  if (s.length <= MAX_STRING_LEN) return s
  return `${s.slice(0, MAX_STRING_LEN)}…[truncated ${s.length} chars]`
}

/** Strip embedded OAuth secrets from JSON-like strings (e.g. verifications.value payloads). */
function redactInlineSecrets(s: string): string {
  if (!/codeVerifier|refresh_token|access_token|client_secret/i.test(s)) return s
  return s
    .replace(/"codeVerifier"\s*:\s*"[^"]*"/gi, '"codeVerifier":"[REDACTED]"')
    .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"')
    .replace(/"refresh_token"\s*:\s*"[^"]*"/gi, '"refresh_token":"[REDACTED]"')
    .replace(/"client_secret"\s*:\s*"[^"]*"/gi, '"client_secret":"[REDACTED]"')
}

function serializeError(err: Error, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  const o = err as Error & {
    code?: unknown
    rawCode?: unknown
    details?: unknown
    proto?: unknown
    status?: unknown
  }
  const base: Record<string, unknown> = {
    type: err.constructor?.name ?? 'Error',
    name: err.name,
    message: err.message,
    stack: err.stack ? truncateString(err.stack) : undefined,
  }
  if (o.code !== undefined) base.code = o.code
  if (o.rawCode !== undefined) base.rawCode = o.rawCode
  if (o.status !== undefined) base.httpStatus = o.status
  if (o.details !== undefined) base.details = serializeForLogInner(o.details, depth + 1, seen)
  if (o.proto !== undefined) {
    try {
      base.proto =
        typeof o.proto === 'object' && o.proto !== null
          ? serializeForLogInner(o.proto as object, depth + 1, seen)
          : o.proto
    } catch {
      base.proto = String(o.proto)
    }
  }
  if (err.cause !== undefined) base.cause = serializeForLogInner(err.cause, depth + 1, seen)
  return base
}

function serializeForLogInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return '[MaxDepth]'
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return truncateString(value)
  if (typeof value === 'function') return `[Function ${(value as () => void).name || 'anonymous'}]`
  if (typeof value === 'symbol') return value.toString()

  if (value instanceof Error) return serializeError(value, depth, seen)

  if (Array.isArray(value)) {
    return value.map((v) => serializeForLogInner(v, depth + 1, seen))
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)
    const out: Record<string, unknown> = {}
    const keys = [...Object.keys(obj), ...Object.getOwnPropertyNames(obj)]
    const uniq = [...new Set(keys)]
    for (const key of uniq) {
      if (key === 'stack' && obj[key] === undefined) continue
      let v: unknown
      try {
        v = obj[key]
      } catch {
        out[key] = '[Unreadable]'
        continue
      }
      if (SENSITIVE_KEY.test(key)) {
        if (typeof v === 'string' && v.length > 0) out[key] = `[REDACTED len=${v.length}]`
        else out[key] = '[REDACTED]'
      } else {
        out[key] = serializeForLogInner(v, depth + 1, seen)
      }
    }
    return out
  }

  return String(value)
}

/** Serialize any thrown value for structured logs (safe for Pino / JSON). */
export function serializeForLog(value: unknown): unknown {
  return serializeForLogInner(value, 0, new WeakSet<object>())
}
