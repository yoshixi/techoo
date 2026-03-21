/**
 * Centralized environment variable access.
 *
 * validateEnv() runs once at application startup and throws if
 * required fields are missing. After that, getEnv() returns a
 * typed object — callers can trust that required fields are present.
 */

/** Env vars that must be set for the app to start. */
interface RequiredEnv {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  JWT_SECRET: string
}

/** Env vars that are optional or feature-gated. */
interface OptionalEnv {
  NODE_ENV?: string
  TRUSTED_ORIGINS?: string
  MOBILE_REDIRECT_URIS?: string

  // Google OAuth
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REDIRECT_URI?: string

  // Centralized DB (Turso)
  TURSO_CONNECTION_URL?: string
  TURSO_AUTH_TOKEN?: string

  // Local dev DB
  SQLITE_URL?: string

  // Multi-tenant (tenanso)
  TURSO_ORG_SLUG?: string
  TURSO_API_TOKEN?: string
  TURSO_GROUP?: string
  TURSO_GROUP_AUTH_TOKEN?: string
  TURSO_TENANT_DB_URL?: string
  TURSO_SEED_DB?: string
  TURSO_API_BASE_URL?: string

  // Webhooks
  WEBHOOK_BASE_URL?: string
}

export interface AppEnv extends RequiredEnv, OptionalEnv {}

const REQUIRED_KEYS = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'JWT_SECRET',
] as const satisfies readonly (keyof RequiredEnv)[]

/**
 * Validates that all required env vars are present.
 * Call once at application startup. Throws if any are missing.
 */
export function validateEnv(): void {
  const raw = process.env as Record<string, string | undefined>
  const missing: string[] = []

  for (const key of REQUIRED_KEYS) {
    if (!raw[key]?.trim()) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }
}

/**
 * Returns typed env vars from process.env.
 */
export function getEnv(): AppEnv {
  if (typeof process === 'undefined') return {} as AppEnv
  return process.env as unknown as AppEnv
}
