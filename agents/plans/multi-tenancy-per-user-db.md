---
title: "Multi-Tenancy: Per-User Database with Tenanso"
brief_description: "Separate the database into per-user databases using Turso and the tenanso library for complete data isolation."
created_at: "2026-03-19"
update_at: "2026-03-19"
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

**Single schema file** (`schema.ts`) — same as today, no split needed. All three database types share the same full schema. Tables that aren't used in a given DB simply remain empty (zero cost in SQLite).

**Note:** Turso's multi-db schema propagation feature is deprecated for new users, so we use a migration script approach instead.

```
schema.ts (single source of truth)
    │
    ├──→ drizzle-kit generate → migration files
    │
    ├──→ drizzle-kit migrate → Centralized DB
    │
    ├──→ drizzle-kit push → Seed DB (keeps template up to date for new users)
    │
    └──→ migration script → iterates all tenant DBs via tenanso.listTenants()
                             and applies migrations to each
```

**Schema change workflow:**
1. Edit `schema.ts`
2. `drizzle-kit generate` → create migration files
3. `drizzle-kit migrate` → apply to centralized DB
4. `drizzle-kit push` → apply to seed DB (so new users get latest schema)
5. Run tenant migration script → apply migrations to all existing user DBs

**Tenant migration script** (`scripts/migrate-tenants.ts`):
```typescript
import { migrate } from 'drizzle-orm/libsql/migrator'

const tenanso = getTenanso()
const tenants = await tenanso.listTenants()
for (const tenant of tenants) {
  await tenanso.withTenant(tenant, async (db) => {
    await migrate(db, { migrationsFolder: './migrations' })
  })
}
```

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

## Implementation Steps

### 1. Database Layer (`common.db.ts`)
- `getMainDb()` — returns the centralized auth database (singleton, same as current `getDb()`)
- `getTenanso()` — lazy-init tenanso instance
- `getTenantDbForUser(userId)` — convenience for `tenanso.dbFor('user-{userId}')`
- Local dev fallback: when tenanso env vars absent, `getTenantDbForUser()` returns `getMainDb()` (single DB mode, same as today)

### 2. Hono Context & Middleware
- `AppBindings.Variables` adds `db: DB`
- JWT middleware (after auth): derives tenant from user ID, sets `c.set('db', tenantDb)`
- Handlers access tenant DB via `c.get('db')`
- Handlers needing centralized DB (OAuth operations) import `getMainDb()` directly

### 3. Handler Updates
All domain handlers replace `const db = getDb()` with `const db = c.get('db')`.

### 4. Webhook Handler (Public Route)
- Encodes tenant name in Google channel token when creating a watch
- On webhook receipt: extracts tenant from `X-Goog-Channel-Token` header
- Gets tenant DB via `getTenantDbForUser()`, centralized DB via `getMainDb()` for OAuth tokens

### 5. Tenant Provisioning
- better-auth `databaseHooks.user.create.after` creates the tenant DB via `tenanso.createTenant()`
- Runs only when tenanso is configured (production)

### 6. Auth Module (`auth.ts`)
- Replace `getDb()` calls with `getMainDb()` — auth always uses the centralized DB

### 7. Drizzle Config
- `drizzle.config.ts` — existing config, used for centralized DB migrations
- `drizzle.config.seed.ts` — new config, points to seed DB for `drizzle-kit push`
- Both use the same `schema.ts`

### 8. Tenant Migration Script
- `scripts/migrate-tenants.ts` — iterates all tenants and applies Drizzle migrations
- Added as npm script: `pnpm --filter @apps/backend run migrate:tenants`
