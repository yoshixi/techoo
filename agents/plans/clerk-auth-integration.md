# Clerk Authentication Integration Plan

## Overview

Integrate Clerk authentication into Shuchu using **Clerk as an OIDC Identity Provider**. This approach uses standard OAuth 2.0 / OpenID Connect protocols, which are well-documented and supported for desktop applications.

**Key Insight**: Clerk doesn't have an official Electron SDK, but it can act as a standard OIDC Identity Provider. We use the Authorization Code flow with PKCE, which is the recommended approach for public clients (desktop apps).

**Architecture Decision**: All OAuth URL generation and token exchange happens on the backend. This keeps Clerk credentials secure on the server and simplifies the Electron client.

## Implementation Status

- [x] Phase 1: Backend Authentication
- [x] Phase 2: Backend OAuth Endpoints
- [x] Phase 3: Electron OAuth Flow
- [x] Phase 4: Renderer Integration

## Authentication Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Electron   │────>│   Backend   │────>│   Clerk     │
│    App      │     │    API      │     │   (IdP)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │ GET /auth/url     │                   │
       │──────────────────>│                   │
       │<── authUrl +      │                   │
       │    sessionId      │                   │
       │                   │                   │
       │── Opens browser ──────────────────────>│
       │                                        │
       │<────── shuchu://auth/callback ─────────│
       │        (auth code + state)             │
       │                   │                   │
       │ POST /auth/token  │                   │
       │──────────────────>│── exchange code ──>│
       │                   │<── tokens ─────────│
       │<── tokens ────────│                   │
       │                   │                   │
       ▼                   │                   │
┌─────────────┐            │                   │
│   Secure    │            │                   │
│   Storage   │            │                   │
└─────────────┘            │                   │
       │                   │                   │
       │ API calls with    │                   │
       │ Bearer token      │                   │
       │──────────────────>│                   │
       │                   │── Verify token ───>│
       │<── response ──────│                   │
```

## Token Types (from Clerk OIDC)

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Authorization Code | 10 minutes | Exchange for tokens (one-time use) |
| ID Token | Short-lived | JWT for backend verification (contains user info) |
| Access Token | 2 hours | Access Clerk's userinfo endpoint |
| Refresh Token | 3 days | Get new access/ID tokens |

Reference: [Clerk as Identity Provider](https://clerk.com/docs/advanced-usage/clerk-idp)

---

## Phase 1: Backend Authentication (Completed)

### 1.1 Database Schema

**File**: `apps/web/app/db/schema/schema.ts`

Provider-agnostic auth tables:

```typescript
// Users table - provider agnostic
export const usersTable = sqliteTable('users', {
  id: blob('id').primaryKey().$type<string>(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});

// Auth providers table - links external identity providers to users
export const userAuthProvidersTable = sqliteTable('user_auth_providers', {
  id: blob('id').primaryKey().$type<string>(),
  userId: blob('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }).$type<string>(),
  provider: text('provider').notNull(),       // 'clerk', 'google', etc.
  providerId: text('provider_id').notNull(),  // External ID from provider
  email: text('email'),
  providerData: text('provider_data'),        // JSON with additional data (e.g., imageUrl)
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniqueProviderUser: unique().on(table.provider, table.providerId),
}));
```

### 1.2 Dependencies

```bash
pnpm --filter web add @clerk/backend
```

Using `@clerk/backend` for JWT verification - provides `verifyToken()` function that handles JWKS fetching and token validation automatically.

### 1.3 Auth Middleware

**File**: `apps/web/app/api/[[...route]]/middleware/auth.ts`

```typescript
import { verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'

export interface AuthContext {
  userId: string    // Clerk user ID from 'sub' claim
  sessionId?: string
  email?: string
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing authorization' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })

    c.set('auth', {
      userId: payload.sub,
      sessionId: payload.sid,
      email: (payload as { email?: string }).email,
    })

    await next()
  } catch (error) {
    return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401)
  }
})
```

### 1.4 User Sync Service

**File**: `apps/web/app/core/auth.db.ts`

Features:
- Provider-agnostic design supporting multiple auth providers
- Race condition handling for concurrent user creation
- No in-memory caching (not effective in serverless environments)

```typescript
export async function findOrCreateUserByProvider(
  db: DB,
  providerInfo: AuthProviderInfo
): Promise<SelectUser> {
  // 1. Look up user_auth_providers table by (provider, providerId)
  // 2. If found, return linked user (update if needed)
  // 3. If not found, create user + auth provider with race condition handling
}
```

### 1.5 Handler Pattern

All handlers use auth context:

```typescript
export const listTasksHandler: RouteHandler<typeof listTasksRoute> = async (c) => {
  const db = getDb()
  const auth = c.get('auth')

  const user = await findOrCreateUserByProvider(db, {
    provider: 'clerk',
    providerId: auth.userId,
    email: auth.email,
  })

  const tasks = await getAllTasks(db, user.id.toString(), filters)
  return c.json({ tasks, total: tasks.length }, 200)
}
```

---

## Phase 2: Backend OAuth Endpoints (Completed)

### 2.1 OAuth Sessions Table

**File**: `apps/web/app/db/schema/schema.ts`

Stores PKCE sessions for OAuth flow:

```typescript
export const oauthSessionsTable = sqliteTable('oauth_sessions', {
  id: blob('id').primaryKey().$type<string>(),
  state: text('state').notNull().unique(),      // Random string for CSRF protection
  codeVerifier: text('code_verifier').notNull(), // PKCE code_verifier
  redirectUri: text('redirect_uri').notNull(),  // Client's callback URL
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(), // Unix timestamp, 10 min TTL
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});
```

### 2.2 OAuth Endpoints

**Files**:
- `apps/web/app/api/[[...route]]/routes/oauth.ts`
- `apps/web/app/api/[[...route]]/handlers/oauth.ts`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/url` | GET | Public | Generate OAuth URL with PKCE |
| `/auth/token` | POST | Public | Exchange code for tokens |

#### GET /auth/url

```typescript
// Request
GET /api/auth/url?redirect_uri=shuchu://auth/callback

// Response
{
  "authUrl": "https://your-app.clerk.accounts.dev/oauth/authorize?...",
  "sessionId": "019414a7-cd12-7000-8000-000000000001"
}
```

Handler:
1. Generates PKCE values (state, code_verifier, code_challenge)
2. Stores session in SQLite with 10-minute TTL
3. Builds Clerk authorization URL
4. Returns authUrl and sessionId

#### POST /auth/token

```typescript
// Request
POST /api/auth/token
{
  "code": "auth_code_from_callback",
  "state": "state_from_callback",
  "sessionId": "session_id_from_auth_url"
}

// Response
{
  "accessToken": "...",
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600
}
```

Handler:
1. Validates session by ID and state
2. Checks session hasn't expired
3. Exchanges code with Clerk using stored code_verifier
4. Deletes session (one-time use)
5. Returns tokens

### 2.3 Route Registration

**File**: `apps/web/app/api/[[...route]]/route.ts`

OAuth routes registered BEFORE auth middleware (public endpoints):

```typescript
// PUBLIC ROUTES (no auth required)
app.openapi(healthRoute, healthHandler)
app.openapi(getAuthUrlRoute, getAuthUrlHandler)
app.openapi(exchangeTokenRoute, exchangeTokenHandler)

// Apply auth middleware to all routes below
app.use('/*', authMiddleware)

// PROTECTED ROUTES
app.openapi(listTasksRoute, listTasksHandler)
// ... other protected routes
```

---

## Phase 3: Electron OAuth Flow (Completed)

### 3.1 Dependencies

```bash
pnpm --filter electron add electron-store
```

Using `electron-store` + Electron's `safeStorage` for secure token storage.

### 3.2 Token Storage

**File**: `apps/electron/src/main/auth/tokenStorage.ts`

```typescript
export interface TokenData {
  accessToken: string
  idToken?: string      // OIDC ID token for backend verification
  refreshToken?: string
  expiresAt: number     // Unix timestamp in milliseconds
}
```

Features:
- Uses `safeStorage.encryptString()` when available
- Falls back to basic storage with warning if encryption unavailable
- 5-minute buffer before token expiry

### 3.3 OAuth Flow Manager

**File**: `apps/electron/src/main/auth/authFlow.ts`

Simplified to use backend endpoints:

```typescript
const API_URL = import.meta.env.MAIN_VITE_API_URL || 'http://localhost:3000'
const REDIRECT_URI = 'shuchu://auth/callback'

let pendingSessionId: string | null = null

export async function login(): Promise<void> {
  // Get auth URL from backend
  const response = await fetch(`${API_URL}/api/auth/url?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`)
  const { authUrl, sessionId } = await response.json()

  // Store session ID for callback
  pendingSessionId = sessionId

  // Open in system browser
  await shell.openExternal(authUrl)
}

export async function handleOAuthCallback(url: string): Promise<boolean> {
  const urlObj = new URL(url)
  const code = urlObj.searchParams.get('code')
  const state = urlObj.searchParams.get('state')

  // Exchange code for tokens via backend
  const response = await fetch(`${API_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, sessionId: pendingSessionId })
  })

  const tokens = await response.json()
  setTokens(tokens)
  pendingSessionId = null
  return true
}
```

### 3.4 Protocol Registration

**File**: `apps/electron/src/main/index.ts`

```typescript
// Register protocol before app is ready
app.setAsDefaultProtocolClient('shuchu')

// macOS: Handle protocol URL when app is running
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleOAuthCallback(url)
})

// Windows: Handle via second-instance
app.on('second-instance', (_event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('shuchu://'))
  if (url) handleOAuthCallback(url)
})
```

### 3.5 IPC Handlers

```typescript
ipcMain.handle('auth:login', async () => {
  await login()
  return { success: true }
})

ipcMain.handle('auth:logout', async () => {
  logout()
})

ipcMain.handle('auth:get-token', async () => {
  return getAccessToken()
})

ipcMain.handle('auth:is-authenticated', async () => {
  return isAuthenticated()
})
```

---

## Phase 4: Renderer Integration (Completed)

### 4.1 HTTP Client

**File**: `apps/electron/src/renderer/src/lib/api/mutator.ts`

```typescript
export const customInstance = async <T>(config: CustomRequestConfig): Promise<T> => {
  const accessToken = await window.api.auth.getToken()

  const response = await fetch(url.toString(), {
    method: config.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': accessToken ? `Bearer ${accessToken}` : '',
      ...config.headers,
    },
    body: config.data ? JSON.stringify(config.data) : undefined,
  })

  if (response.status === 401) {
    authRequiredCallbacks.forEach(cb => cb())
    throw new Error('Unauthorized')
  }

  return response.json()
}
```

### 4.2 Auth Context

**File**: `apps/electron/src/renderer/src/contexts/AuthContext.tsx`

```typescript
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    window.api.auth.isAuthenticated().then(setIsAuthenticated)
    const unsubscribe = window.api.auth.onAuthStateChange(setIsAuthenticated)
    const unsubscribe401 = onAuthRequired(() => setIsAuthenticated(false))
    return () => { unsubscribe(); unsubscribe401() }
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### 4.3 Login Screen

**File**: `apps/electron/src/renderer/src/components/LoginScreen.tsx`

Simple login UI with "Sign in with Clerk" button.

---

## Environment Variables

### Web App (`apps/web/.env.local`)
```bash
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_FRONTEND_API=your-app.clerk.accounts.dev
```

### Electron App (`apps/electron/.env`)
```bash
VITE_API_URL=http://localhost:3000/api
MAIN_VITE_API_URL=http://localhost:3000
```

**Note**: Electron no longer needs Clerk credentials - all OAuth is handled by the backend.

---

## Critical Files

| File | Description |
|------|-------------|
| `apps/web/app/db/schema/schema.ts` | User, auth provider, and OAuth session tables |
| `apps/web/app/api/[[...route]]/route.ts` | Route registration with public OAuth endpoints |
| `apps/web/app/api/[[...route]]/middleware/auth.ts` | JWT verification with @clerk/backend |
| `apps/web/app/api/[[...route]]/routes/oauth.ts` | OAuth route definitions |
| `apps/web/app/api/[[...route]]/handlers/oauth.ts` | OAuth handlers (URL generation, token exchange) |
| `apps/web/app/core/auth.db.ts` | User sync with race condition handling |
| `apps/web/app/core/oauth.db.ts` | OAuth session CRUD operations |
| `apps/electron/src/main/auth/authFlow.ts` | Simplified OAuth flow using backend |
| `apps/electron/src/main/auth/tokenStorage.ts` | Secure token storage |
| `apps/electron/src/preload/index.ts` | Expose auth API to renderer |
| `apps/electron/src/renderer/src/contexts/AuthContext.tsx` | Auth state management |

---

## Verification Steps

1. **Backend OAuth endpoints**:
   ```bash
   pnpm --filter web run dev:local

   # Get auth URL
   curl "http://localhost:3000/api/auth/url?redirect_uri=shuchu://auth/callback"
   # Should return: { "authUrl": "https://...", "sessionId": "..." }

   # Protected endpoint without auth
   curl http://localhost:3000/api/tasks
   # Should return 401
   ```

2. **Electron OAuth Flow**:
   - Start app: `pnpm --filter electron run dev`
   - Should show login screen
   - Click login → opens browser → auth → redirects back
   - App should show main UI with user's tasks

3. **Multi-user**:
   - Login as different users
   - Verify each user sees only their own data

4. **Type safety**:
   ```bash
   pnpm run check-types
   ```

---

## Security Considerations

- **PKCE on backend**: Code verifier never leaves the server
- **Session TTL**: 10-minute expiry prevents session theft
- **One-time use**: Sessions deleted after token exchange
- **CSRF protection**: State parameter validated on callback
- **Protocol validation**: Only allowed protocols (shuchu://, http://, https://)
- **Credentials on server**: Clerk credentials only on backend, not exposed to clients

---

## Implementation Decisions

### Why backend-generated OAuth URLs?

- Clerk credentials stay on the server (more secure)
- Simpler Electron client (no crypto operations)
- Centralized configuration
- Works well with serverless (PKCE stored in database)

### Why SQLite for OAuth sessions?

- Persistent across serverless function invocations
- Simple cleanup of expired sessions
- No external dependencies (Redis, etc.)

### Why no in-memory user cache?

- Not effective in serverless environments (each instance has separate cache)
- Added complexity without benefit
- Database queries are fast with indexed lookups

### Why `@clerk/backend` instead of `jose`?

- `verifyToken()` handles JWKS fetching automatically
- Less boilerplate code
- Clerk-specific optimizations

### Why separate `userAuthProvidersTable`?

- Keeps `usersTable` provider-agnostic
- Supports multiple auth providers per user
- Easy to add new providers without schema changes

---

## Future Considerations

- **Token refresh endpoint**: Add `POST /auth/refresh` for backend-managed refresh
- **Mobile (React Native)**: Use `@clerk/clerk-expo` with `expo-secure-store`
- **Web**: Use `@clerk/nextjs` middleware + `@clerk/clerk-react`
- **Additional providers**: Can easily add Google, GitHub direct OAuth

---

## References

- [Clerk as Identity Provider](https://clerk.com/docs/advanced-usage/clerk-idp)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [@clerk/backend](https://clerk.com/docs/references/backend/overview)
- [Electron Deep Links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [electron-store](https://github.com/sindresorhus/electron-store)
