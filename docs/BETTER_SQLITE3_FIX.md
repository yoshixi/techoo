---
title: "🔧 Better-SQLite3 Native Module Fix"
brief_description: "🔧 Better-SQLite3 Native Module Fix"
created_at: "2025-12-20"
update_at: "2026-01-25"
---

# 🔧 Local LibSQL Troubleshooting

## Issue
Local database fails to open or API returns database connection errors.

## What the app uses now
The backend uses the LibSQL client with a local file database by default:
- `apps/backend/tmp/local.db`
- Driver: `@libsql/client` via `drizzle-orm/libsql`

## Fixes

### Option 1: Regenerate the local DB file
```bash
cd apps/backend
rm -f tmp/local.db
pnpm drizzle:push
```

### Option 2: Verify Turso credentials (for production or remote dev)
```bash
export TURSO_CONNECTION_URL=your-turso-url
export TURSO_AUTH_TOKEN=your-turso-token
```

### Option 3: Ensure you are in the devenv shell
```bash
devenv shell
pnpm --filter backend dev
```

## Testing
```bash
pnpm --filter backend dev
# Check /api/health on the backend URL printed by Wrangler
```
