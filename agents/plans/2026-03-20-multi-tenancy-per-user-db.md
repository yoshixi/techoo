**Date:** 2026-03-20
**Status:** Accepted
**Branch:** multi-tenancy-per-user-db

---

---
title: "Multi-Tenancy: Per-User Database with Tenanso"
brief_description: "Separate the database into per-user databases using Turso and the tenanso library for complete data isolation."
created_at: "2026-03-19"
update_at: "2026-03-20"
---

# Multi-Tenancy: Per-User Database with Tenanso

## Overview
Separate the database into per-user databases using Turso and the [tenanso](https://github.com/yoshixi/tenanso) library. Each authenticated user gets their own SQLite database via Turso, providing complete data isolation.

## Three Database Types

| Database | Count | Purpose | Data |
|----------|-------|---------|------|
| **Centralized DB** | 1 | Auth & identity (better-auth, JWT) | `users`, `sessions`, `accounts`, `verifications`, `oauth_exchange_codes` have data; domain tables exist but are empty |
| **Seed DB** | 1 | Template for cloning new user DBs (never queried at runtime) | All tables exist with correct schema, no data rows |
| **User DB (tenant)** | N (one per user) | User's domain data | `tasks`, `timers`, `comments`, `tags`, `calendars`, `events`, `watch_channels`, `notes` have data; auth tables exist but are empty |

## Schema Management

**Single schema file** (`schema.ts`) — all three database types share the same full schema. Tables that aren't used in a given DB simply remain empty (zero cost in SQLite).

**Note:** Turso's multi-db schema propagation feature is deprecated for new users, so we use a migration script approach instead.

```
schema.ts (single source of truth)
    │
    ├──→ drizzle-kit generate → migration files (./migrations/)
    │
    ├──→ drizzle-kit migrate → Centralized DB (drizzle.config.ts)
    │
    ├──→ drizzle-kit push → Seed DB (drizzle.config.seed.ts)
    │
    └──→ scripts/migrate-tenants.ts → iterates all tenant DBs via tenanso.listTenants()
                                       and applies migrations to each
```

**Schema change workflow:**
1. Edit `schema.ts`
2. `pnpm --filter @apps/backend run drizzle:generate:prod` → create migration files
3. `pnpm --filter @apps/backend run drizzle:migrate:prod` → apply to centralized DB
4. `pnpm --filter @apps/backend run drizzle:push:seed` → apply to seed DB (so new users get latest schema)
5. `pnpm --filter @apps/backend run migrate:tenants` → apply migrations to all existing user DBs

### Tenant Naming
Each user's tenant is named `user-{userId}` (e.g., `user-42`).

### New Environment Variables
- `TURSO_ORG_SLUG` — Turso organization slug
- `TURSO_API_TOKEN` — Platform API token for tenanso
- `TURSO_GROUP` — Database group name
- `TURSO_GROUP_AUTH_TOKEN` — Group auth token for tenant DB connections
- `TURSO_TENANT_DB_URL` — URL template like `libsql://{tenant}-org-group.turso.io`
- `TURSO_SEED_DB` — Seed database name

Existing `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` continue to be used for the centralized DB.

## Architecture

### Database Access Control

Handlers are forbidden from accessing the centralized DB directly. The `getMainDb()` implementation lives in `core/internal/main-db.ts`. Only core modules may import from `internal/`.

| Caller | Centralized DB access | Tenant DB access |
|--------|----------------------|-----------------|
| **Handlers** | Via `c.get('oauth')` (OAuthService) | Via `c.get('db')` |
| **core/auth.ts** | Direct import from `internal/main-db` | N/A |
| **core/oauth.service.ts** | Direct import from `internal/main-db` | N/A |
| **core/exchange-codes.ts** | Direct import from `internal/main-db` | N/A |
| **Webhook handler** | Via `createOAuthService(userId)` | Via `getTenantDbForUser(userId)` |

### Key Files

| File | Role |
|------|------|
| `core/internal/main-db.ts` | Owns `getMainDb()` implementation (singleton, centralized DB) |
| `core/common.db.ts` | Re-exports `getMainDb()`, owns `getTenanso()`, `getTenantDbForUser()`, `DB` type |
| `core/oauth.service.ts` | User-scoped OAuth service — wraps centralized DB queries behind `getTokenForAccount()`, `listAccounts()`, `listAccountRecords()`, `updateToken()` |
| `core/exchange-codes.ts` | `createExchangeCode()`, `consumeExchangeCode()` — extracted from route.ts |
| `api/.../types.ts` | `AppBindings.Variables` = `{ user, db, oauth }` |
| `api/.../route.ts` | JWT middleware sets `c.set('db', tenantDb)` and `c.set('oauth', oauthService)` |
| `drizzle.config.ts` | Drizzle config for centralized DB (local SQLite or Turso) |
| `drizzle.config.seed.ts` | Drizzle config for seed DB (push-only, no migrations) |
| `scripts/migrate-tenants.ts` | Iterates all tenants via `tenanso.listTenants()` and applies Drizzle migrations |

### Hono Context & Middleware

The JWT middleware (in `route.ts`) runs for all authenticated routes and sets:
- `c.set('user', { id, email, name })` — from JWT payload
- `c.set('db', getTenantDbForUser(userId))` — per-user tenant database
- `c.set('oauth', createOAuthService(userId))` — user-scoped OAuth service

Public routes (auth, webhooks, token exchange) skip the middleware. The webhook handler resolves the tenant from `X-Goog-Channel-Token` and constructs its own `OAuthService` via `createOAuthService(userId)`.

### Handler Pattern
All domain handlers use `c.get('db')` for tenant data:
```typescript
const db = c.get('db')    // tenant DB (tasks, timers, etc.)
const oauth = c.get('oauth')  // OAuth operations on centralized DB
```

### Webhook Handler (Public Route)
- Encodes tenant name in Google channel token when creating a watch: `user-{id}:{uuid}`
- On webhook receipt: extracts tenant from `X-Goog-Channel-Token` header
- Gets tenant DB via `getTenantDbForUser()`, OAuth via `createOAuthService()` (no JWT context)

### Tenant Provisioning
- better-auth `databaseHooks.user.create.after` creates the tenant DB via `tenanso.createTenant()`
- Runs only when tenanso is configured (production)

### Local Dev Fallback
When tenanso env vars are absent, `getTenantDbForUser()` returns `getMainDb()` (single DB mode). The `createOAuthService()` also falls back to `getMainDb()`. This means local development works identically to before — all data in one SQLite file.
