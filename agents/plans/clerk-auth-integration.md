# Clerk Authentication Integration Plan

## Overview

Integrate Clerk authentication into Shuchu using **Clerk as an OIDC Identity Provider**. This approach uses standard OAuth 2.0 / OpenID Connect protocols, which are well-documented and supported for desktop applications.

**Key Insight**: Clerk doesn't have an official Electron SDK, but it can act as a standard OIDC Identity Provider. We use the Authorization Code flow with PKCE, which is the recommended approach for public clients (desktop apps).

## Implementation Status

- [x] Phase 1: Backend Authentication
- [x] Phase 2: Electron OAuth Flow
- [x] Phase 3: Renderer Integration

## Authentication Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Electron   │────>│   Browser   │────>│   Clerk     │
│    App      │     │  (System)   │     │   (IdP)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │<──────── shuchu://auth/callback ──────│
       │         (auth code + state)           │
       │                                       │
       │────── Token Exchange (PKCE) ─────────>│
       │<────── ID Token + Access Token ───────│
       │        + Refresh Token                │
       │                                       │
       ▼                                       │
┌─────────────┐                                │
│  Backend    │<── Verify Token (@clerk/backend)│
│    API      │                                │
└─────────────┘
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

### 1.1 Database Schema Changes

**File**: `apps/web/app/db/schema/schema.ts`

Added provider-agnostic auth table to decouple authentication from users:

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

### 1.4 User Sync Service with Caching

**File**: `apps/web/app/core/auth.db.ts`

Features:
- In-memory cache with 5-minute TTL for performance
- Race condition handling for concurrent user creation
- Provider-agnostic design supporting multiple auth providers

```typescript
// In-memory cache (TTL: 5 minutes)
const userCache = new Map<string, { user: SelectUser; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function findOrCreateUserByProvider(
  db: DB,
  providerInfo: AuthProviderInfo
): Promise<SelectUser> {
  // 1. Check cache first
  // 2. Look up user_auth_providers table
  // 3. If found, return linked user (update if needed)
  // 4. If not found, create user + auth provider with race condition handling
}

export function invalidateUserCache(provider: string, providerId: string): void {
  userCache.delete(getCacheKey(provider, providerId))
}
```

### 1.5 Handler Pattern

All handlers updated to use auth context:

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

## Phase 2: Electron OAuth Flow (Completed)

### 2.1 Dependencies

```bash
pnpm --filter electron add electron-store
```

Using `electron-store` + Electron's `safeStorage` for secure token storage.

### 2.2 Token Storage

**File**: `apps/electron/src/main/auth/tokenStorage.ts`

Features:
- Stores access token, ID token, and refresh token
- Uses `safeStorage.encryptString()` when available
- Falls back to basic storage with warning if encryption unavailable
- 5-minute buffer before token expiry

```typescript
export interface TokenData {
  accessToken: string
  idToken?: string      // OIDC ID token for backend verification
  refreshToken?: string
  expiresAt: number     // Unix timestamp in milliseconds
}
```

### 2.3 OAuth Flow Manager

**File**: `apps/electron/src/main/auth/authFlow.ts`

Features:
- PKCE flow with SHA-256 code challenge
- Custom protocol handler (`shuchu://auth/callback`)
- Automatic token refresh when expired
- State parameter for CSRF protection

```typescript
// Custom protocol for OAuth callback
const PROTOCOL = 'shuchu'
const CALLBACK_PATH = 'auth/callback'
const REDIRECT_URI = `${PROTOCOL}://${CALLBACK_PATH}`

export async function login(): Promise<void> {
  // 1. Generate PKCE values (code_verifier, code_challenge)
  // 2. Generate random state for CSRF protection
  // 3. Build Clerk authorization URL
  // 4. Open in system browser
}

export async function handleOAuthCallback(url: string): Promise<boolean> {
  // 1. Validate state matches
  // 2. Exchange code for tokens using PKCE
  // 3. Store tokens securely
}

export async function getAccessToken(): Promise<string | null> {
  // Auto-refresh if expired
}
```

### 2.4 Protocol Registration

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

### 2.5 IPC Handlers

```typescript
ipcMain.handle('auth:login', async () => {
  try {
    await login()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
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

### 2.6 Preload Script

**File**: `apps/electron/src/preload/index.ts`

```typescript
auth: {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  isAuthenticated: () => ipcRenderer.invoke('auth:is-authenticated'),
  onAuthStateChange: (callback) => {
    const handler = (_, isAuthenticated) => callback(isAuthenticated)
    ipcRenderer.on('auth:state-changed', handler)
    return () => ipcRenderer.removeListener('auth:state-changed', handler)
  },
},
```

---

## Phase 3: Renderer Integration (Completed)

### 3.1 HTTP Client

**File**: `apps/electron/src/renderer/src/lib/api/mutator.ts`

Features:
- Automatically injects Authorization header
- Handles 401 responses with auth required callback
- Supports retry logic

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

### 3.2 Auth Context

**File**: `apps/electron/src/renderer/src/contexts/AuthContext.tsx`

```typescript
export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check initial auth state
    window.api.auth.isAuthenticated().then(setIsAuthenticated)

    // Listen for auth state changes from main process
    const unsubscribe = window.api.auth.onAuthStateChange(setIsAuthenticated)

    // Listen for 401 responses from API calls
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

### 3.3 Login Screen

**File**: `apps/electron/src/renderer/src/components/LoginScreen.tsx`

Simple login UI with "Sign in with Clerk" button.

### 3.4 App Entry

**File**: `apps/electron/src/renderer/src/main.tsx`

```typescript
function AppWithAuth() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoginScreen />
  return <App />
}

root.render(
  <StrictMode>
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  </StrictMode>
)
```

---

## Environment Variables

### Web App (`apps/web/.env.local`)
```bash
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

### Electron App (`apps/electron/.env`)
```bash
VITE_API_URL=http://localhost:3000/api
MAIN_VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
MAIN_VITE_CLERK_FRONTEND_API=your-app.clerk.accounts.dev
```

---

## Critical Files

| File | Status |
|------|--------|
| `apps/web/app/db/schema/schema.ts` | Updated: Added `userAuthProvidersTable` |
| `apps/web/app/api/[[...route]]/route.ts` | Updated: Added auth middleware |
| `apps/web/app/api/[[...route]]/middleware/auth.ts` | **NEW**: JWT verification with @clerk/backend |
| `apps/web/app/core/auth.db.ts` | **NEW**: User sync with caching |
| `apps/web/app/api/[[...route]]/handlers/*.ts` | Updated: Use `findOrCreateUserByProvider()` |
| `apps/electron/src/main/index.ts` | Updated: Protocol + IPC handlers |
| `apps/electron/src/main/auth/tokenStorage.ts` | **NEW**: Secure token storage |
| `apps/electron/src/main/auth/authFlow.ts` | **NEW**: OAuth PKCE flow |
| `apps/electron/src/preload/index.ts` | Updated: Expose auth API |
| `apps/electron/src/renderer/src/lib/api/mutator.ts` | Updated: Auth headers + 401 handling |
| `apps/electron/src/renderer/src/contexts/AuthContext.tsx` | **NEW**: Auth state |
| `apps/electron/src/renderer/src/components/LoginScreen.tsx` | **NEW**: Login UI |
| `apps/electron/src/renderer/src/main.tsx` | Updated: Auth gating |
| `apps/electron/src/renderer/src/components/SettingsView.tsx` | Updated: Logout button |

---

## Verification Steps

1. **Backend Auth**:
   ```bash
   pnpm --filter web run dev:local
   curl http://localhost:3000/api/tasks  # Should return 401
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

## Implementation Decisions

### Why `@clerk/backend` instead of `jose`?

- `@clerk/backend` provides `verifyToken()` which handles JWKS fetching automatically
- Less boilerplate code for token verification
- Clerk-specific optimizations and error handling

### Why `electron-store` + `safeStorage` instead of `keytar`?

- `electron-store` is simpler and doesn't require native module compilation
- `safeStorage` provides OS-level encryption when available
- Works out of the box on all platforms without additional setup

### Why separate `userAuthProvidersTable`?

- Keeps `usersTable` provider-agnostic
- Supports multiple auth providers per user
- Easy to add new providers without schema changes
- Clean separation of concerns

---

## Future Considerations

- **Mobile (React Native)**: Use `@clerk/clerk-expo` with `expo-secure-store`
- **Web**: Use `@clerk/nextjs` middleware + `@clerk/clerk-react`
- **Additional providers**: Can easily add Google, GitHub direct OAuth as alternatives to Clerk

---

## References

- [Clerk as Identity Provider](https://clerk.com/docs/advanced-usage/clerk-idp)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [@clerk/backend](https://clerk.com/docs/references/backend/overview)
- [Electron Deep Links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [electron-store](https://github.com/sindresorhus/electron-store)
