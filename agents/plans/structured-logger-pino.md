# Introduce Pino Structured Logger

## Context

The backend uses ~77 scattered `console.log/error/warn` calls with no structure, timestamps, or request correlation. Introducing Pino provides structured JSON logging with request IDs, user context, and proper log levels.

**Design principle**: Log at the handler/middleware layer (caller side), keep core functions pure. Core functions throw on error, handlers catch and log with full request context. Only pass `logger` explicitly to complex multi-step functions that need internal observability (calendar sync, webhooks).

`nodejs_compat` is already enabled in `wrangler.jsonc`, so Pino works on CF Workers.

## Plan

### Phase 1: Foundation

**Step 1 — Install Pino**
```bash
pnpm --filter @apps/backend add pino
pnpm --filter @apps/backend add -D pino-pretty
```

**Step 2 — Create logger module: `apps/backend/src/app/lib/logger.ts`**
- Export `rootLogger` (base Pino instance) and re-export `Logger` type
- Config: ISO timestamps, error serializer, level based on environment
- No transports (incompatible with Workers) — JSON to stdout

**Step 3 — Create logger middleware: `apps/backend/src/app/api/[[...route]]/middleware/logger.ts`**
- Generate `requestId` via `crypto.randomUUID()`
- Create child logger with `{ requestId, method, path }`
- Set `logger` and `requestId` on Hono context
- Log request start + completion (with status, duration)

**Step 4 — Update `types.ts`**: Add `logger: Logger` and `requestId: string` to `AppBindings.Variables`

**Step 5 — Update `route.ts`**: Register logger middleware first in chain (before CORS)

### Phase 2: Auth Enrichment

**Step 6 — Update `middleware/jwt-auth.ts`**: After setting user, enrich logger with `userId`:
```typescript
c.set('logger', c.get('logger').child({ userId }))
```

### Phase 3: Migrate handlers and middleware

**Step 7 — Update all handler files** to use `c.get('logger')` in catch blocks

```typescript
// Before
catch (error) {
  console.error('Error fetching tasks:', error)
  return c.json({ error: 'Internal server error', ... }, 500)
}

// After
catch (error) {
  c.get('logger').error({ err: error }, 'failed to fetch tasks')
  return c.json({ error: 'Internal server error', ... }, 500)
}
```

Handler files (~11):
`tasks.ts`, `timers.ts`, `tags.ts`, `comments.ts`, `notes.ts`, `events.ts`, `activities.ts`, `calendars.ts`, `webhooks.ts`, `google-auth.ts`, `auth.ts`

**Step 8 — Special: `webhooks.ts` and `calendars.ts`**
These are complex multi-step handlers with rich internal logging (channelId, resourceId, sync results). Create child loggers with domain-specific bindings:
```typescript
const logger = c.get('logger').child({ channelId, resourceId })
```
For core functions called from these handlers that need internal logging (e.g., calendar sync), pass `logger` as an explicit parameter.

**Step 9 — `middleware/better-auth.ts`**: Use `c.get('logger')` for error logging

### Phase 4: Migrate standalone modules

**Step 10 — `core/auth.ts`**: Use `rootLogger.child({ module: 'auth' })` for auth initialization and better-auth logger config

**Step 11 — `lib/utils.ts`**: Replace `console.error` with `rootLogger.error`

**Step 12 — `core/common.core.ts`**: Replace any `console.warn` with `rootLogger.child({ module: 'common' }).warn`

### Phase 5: Test Updates

**Step 13 — Update test helpers**: Set `pino({ level: 'silent' })` as logger and `'test-request-id'` as requestId in `createTestApp` middleware

### Phase 6: DX (Optional)

**Step 14** — Add `"dev:pretty": "pnpm dev 2>&1 | pnpm pino-pretty"` script

## Key Files

| File | Action |
|------|--------|
| `apps/backend/src/app/lib/logger.ts` | **Create** |
| `apps/backend/src/app/api/[[...route]]/middleware/logger.ts` | **Create** |
| `apps/backend/src/app/api/[[...route]]/types.ts` | Modify |
| `apps/backend/src/app/api/[[...route]]/route.ts` | Modify |
| `apps/backend/src/app/api/[[...route]]/middleware/jwt-auth.ts` | Modify |
| `apps/backend/src/app/api/[[...route]]/middleware/better-auth.ts` | Modify |
| `apps/backend/src/app/api/[[...route]]/handlers/*.ts` | Modify (~11 files) |
| `apps/backend/src/app/core/auth.ts` | Modify |
| `apps/backend/src/app/core/common.core.ts` | Modify (if has console calls) |
| `apps/backend/src/app/lib/utils.ts` | Modify |
| Test files with `createTestApp` | Modify |

**Not changed**: `*.db.ts` and `*.core.ts` function signatures stay as `(db, userId, ...)`.

## Verification

1. `pnpm --filter @apps/backend run check-types` — type safety
2. `pnpm --filter @apps/backend run test` — all tests pass
3. `pnpm --filter @apps/backend run dev` — hit an endpoint, verify structured JSON logs with requestId, method, path, status, duration
4. Hit an authenticated endpoint — verify logs include userId
5. Trigger an error — verify error serialized with stack trace
