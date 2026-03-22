# Refactor Auth/OAuth/Middleware from route.ts

## Problem

`route.ts` lines 179-647 contain auth endpoints, OAuth flows, and JWT middleware defined inline, while all other endpoints follow the pattern of separate `routes/*.ts` (OpenAPI definitions) and `handlers/*.ts` files.

## Approach

The inline code falls into three categories:

1. **Auth endpoints** (`/token`, `/session`, `/session-code`) — can get OpenAPI route definitions + handlers
2. **OAuth flow endpoints** (`/oauth/desktop/*`, `/oauth/mobile/*`) — involve redirects/HTML/cookies so they don't fit OpenAPI cleanly; extract as plain Hono handler registration functions
3. **Middleware** (better-auth sign-up handler, JWT auth middleware) — extract into middleware modules

### New files

| File | Contents |
|------|----------|
| `routes/auth.ts` | OpenAPI route definitions for `/token`, `/session`, `/session-code` |
| `handlers/auth.ts` | Handlers for token, session, session-code |
| `handlers/oauth.ts` | Registration function for all OAuth desktop/mobile endpoints |
| `middleware/better-auth.ts` | better-auth sign-up handler with tenant provisioning |
| `middleware/jwt-auth.ts` | JWT verification middleware |
| `middleware/mobile-redirect.ts` | Mobile redirect URI validation helpers |

### Changes to existing files

- `routes/index.ts` — re-export from `./auth`
- `handlers/index.ts` — re-export from `./auth`
- `route.ts` — replace ~470 lines of inline code with imports and registration calls

### What stays in route.ts

- `createApp()` function structure, CORS setup, `app.doc()`, lazy-init proxy
- Calls to register auth routes via `app.openapi()` (same as other endpoints)
- Calls to `registerOAuthRoutes(app, auth)` and `registerMiddleware(app, auth)`
