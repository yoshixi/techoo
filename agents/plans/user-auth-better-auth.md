# Plan: User Authentication with better-auth

## Context

Shuchu is a task management app with a Hono API backend (Next.js) and Electron desktop client. Currently there is **no authentication** — all operations use a hardcoded "Default User" via `ensureDefaultUser()`. We need multi-user auth to support desktop and future mobile clients.

**Requirements:**
- Email/Password + OAuth (Google, GitHub, Apple)
- Bearer token support for desktop/mobile clients
- **Stateless JWT verification** — no DB lookup per API request
- Extend existing `usersTable` (preserve foreign keys)
- Profile images stored as URLs, not binary data

**Session Architecture (Hybrid: Sessions + JWT):**
- Sessions table in DB → source of truth for revocation and management
- Custom JWT layer (using `jose` library + env var secret) → stateless API verification, no DB per request
- Bearer plugin → transmits session token for non-browser clients
- Flow: Sign in → get session token → exchange for JWT via custom endpoint → use JWT for API calls → re-fetch JWT when expired
- JWT signing key from `JWT_SECRET` env var (HMAC-SHA256) → no database table for keys

---

## Phase 1: Server Foundation

### 1.1 Install better-auth (web app)

```sh
pnpm --filter web add better-auth
```

### 1.2 Make `getDb()` a singleton

**File:** `apps/web/app/core/common.db.ts`

Cache the DB instance so better-auth and handlers share the same connection:

```ts
let dbInstance: DB | null = null;
export function getDb(): DB {
  if (dbInstance) return dbInstance;
  // ... existing creation logic ...
  dbInstance = result;
  return result;
}
```

### 1.3 Extend database schema

**File:** `apps/web/app/db/schema/schema.ts`

#### Current `usersTable` (before):
```ts
export const usersTable = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});
```

#### Extended `usersTable` (after):
```ts
export const usersTable = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),  // URL string only (e.g. OAuth provider profile URL, or external storage URL)
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});
```

**Notes:**
- `id` remains `integer autoIncrement` — all existing FK relationships (tasks, comments, tags) are preserved unchanged
- `email` is NOT NULL + unique — required by better-auth for email/password and OAuth
- `image` stores a URL string, never binary data. For OAuth users, this is the provider's profile image URL (e.g. `https://lh3.googleusercontent.com/...`)

#### New `sessionsTable`:
```ts
export const sessionsTable = sqliteTable('sessions', {
  id: text('id').primaryKey(),  // better-auth generates string IDs for sessions
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  token: text('token').notNull().unique(),  // Acts as refresh token — used to obtain short-lived JWTs
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: integer('user_id', { mode: 'number' }).notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});
```

**Notes:**
- `token` is the session token — acts as a refresh credential for obtaining short-lived JWTs
- Column name must remain `token` (better-auth internal requirement), but functionally it's a refresh token
- `userId` FK to `usersTable.id` with cascade delete (when user is deleted, sessions are cleaned up)
- `expiresAt` is checked server-side to validate session validity (~7 days default)
- `ipAddress` and `userAgent` are optional metadata for security auditing

#### New `accountsTable`:
```ts
export const accountsTable = sqliteTable('accounts', {
  id: text('id').primaryKey(),  // better-auth generates string IDs
  accountId: text('account_id').notNull(),  // Provider-specific user ID (e.g. Google sub, GitHub user ID)
  providerId: text('provider_id').notNull(),  // "credential" for email/password, "google", "github", "apple"
  userId: integer('user_id', { mode: 'number' }).notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),  // OAuth access token (for Google, GitHub, Apple)
  refreshToken: text('refresh_token'),  // OAuth refresh token
  idToken: text('id_token'),  // OAuth ID token (OpenID Connect)
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'number' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'number' }),
  scope: text('scope'),  // OAuth scopes granted
  password: text('password'),  // Hashed password (only for providerId="credential")
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});
```

**Notes:**
- One user can have multiple accounts (email/password + Google + GitHub + Apple)
- `providerId="credential"` → email/password auth, `password` column contains scrypt hash
- `providerId="google"|"github"|"apple"` → OAuth, token columns are populated
- `accountId` is the external provider's user identifier

#### New `verificationsTable`:
```ts
export const verificationsTable = sqliteTable('verifications', {
  id: text('id').primaryKey(),  // better-auth generates string IDs
  identifier: text('identifier').notNull(),  // What is being verified (e.g. email address)
  value: text('value').notNull(),  // Verification token/code
  expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(sql`(unixepoch())`),
});
```

**Notes:**
- Used for email verification flows and password reset tokens
- `identifier` is typically the user's email address
- `value` is a random token that expires at `expiresAt`
- Rows are cleaned up after verification or expiration

#### New type exports:
```ts
export type InsertSession = typeof sessionsTable.$inferInsert;
export type SelectSession = typeof sessionsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
export type SelectAccount = typeof accountsTable.$inferSelect;
export type InsertVerification = typeof verificationsTable.$inferInsert;
export type SelectVerification = typeof verificationsTable.$inferSelect;
```

#### ER Diagram (auth tables relationship):
```
users (id PK, name, email, emailVerified, image, createdAt, updatedAt)
  ├── sessions (id PK, userId FK→users, token, expiresAt, ...)
  ├── accounts (id PK, userId FK→users, providerId, accountId, password, ...)
  ├── tasks (id PK, userId FK→users, ...)          ← existing, unchanged
  ├── task_comments (id PK, authorId FK→users, ...) ← existing, unchanged
  └── tags (id PK, userId FK→users, ...)            ← existing, unchanged

verifications (id PK, identifier, value, expiresAt)  ← standalone, no FK
```

**No `jwks` table** — JWT signing uses `JWT_SECRET` env var (HMAC-SHA256), not database-stored key pairs.

#### Token roles summary:

| Token | Where stored | Lifetime | Used for | DB access |
|-------|-------------|----------|----------|-----------|
| Session token (`sessions.token`) | Client `localStorage` | ~7 days | JWT refresh via `POST /api/token` | Yes (1 lookup per refresh) |
| JWT | Client memory (cached) | 15 min | All API requests (`Authorization: Bearer`) | No |

### 1.4 Push schema to local DB

```sh
pnpm --filter web run drizzle:push:local
```

Delete `tmp/local.db` first for a clean start (no migration needed for dev).

### 1.5 Create better-auth config

**New file:** `apps/web/app/core/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { getDb } from "./common.db";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    usePlural: true,  // maps to "users", "sessions", "accounts", "verifications"
  }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google:  { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    github:  { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
    apple:   { clientId: process.env.APPLE_CLIENT_ID!, clientSecret: process.env.APPLE_CLIENT_SECRET! },
  },
  plugins: [bearer()],
  advanced: {
    database: { generateId: false },  // use DB auto-increment for user IDs
  },
});
```

### 1.6 Create custom JWT utility

**New file:** `apps/web/app/core/jwt.ts`

Custom JWT signing/verification using `jose` library + `JWT_SECRET` env var. No database table needed.

```ts
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ISSUER = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const JWT_EXPIRATION = "15m";

export interface JwtPayload {
  sub: string;  // user ID (as string for JWT standard)
  email: string;
  name: string;
}

// Sign a JWT with user info (called after session validation)
export async function signJwt(user: { id: number; email: string; name: string }): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

// Verify a JWT and extract payload (called on every API request — no DB access)
export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: ISSUER });
  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
  };
}
```

**How it works:**
- `JWT_SECRET` env var (e.g. `openssl rand -base64 32`) → symmetric HMAC-SHA256 key
- `signJwt()` → called once per JWT refresh (every ~15 min), requires session validation (DB access)
- `verifyJwt()` → called on every API request, pure crypto operation, **zero DB access**

### 1.7 Create JWT token exchange endpoint

**New Hono route:** `POST /api/token`

Clients send their session token (Bearer) to get a short-lived JWT:

```ts
app.post('/token', async (c) => {
  // Validate session token via better-auth (DB lookup — once per 15 min)
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Sign a short-lived JWT with user info
  const jwt = await signJwt(session.user);
  return c.json({ token: jwt });
});
```

**Environment variables** (add to `.env`):
- `BETTER_AUTH_SECRET` — random 32+ char string (for better-auth internals)
- `BETTER_AUTH_URL` — `http://localhost:3000`
- `JWT_SECRET` — random 32+ char string for JWT HMAC-SHA256 signing (e.g. `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`

### 1.8 Mount auth handler & middleware in Hono

**File:** `apps/web/app/api/[[...route]]/route.ts`

1. Define `AppBindings` type with `user` context variable
2. Mount better-auth catch-all: `app.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))`
3. Mount token exchange endpoint: `app.post('/token', ...)`
4. Add JWT auth middleware using `verifyJwt()` from `jwt.ts`:

```ts
import { verifyJwt } from '../../../core/jwt';

// Skip public routes, verify JWT on all data routes
app.use('/*', async (c, next) => {
  const path = c.req.path;
  if (path.startsWith('/api/auth') || path === '/api/token'
      || path === '/api/health' || path === '/api/doc') {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyJwt(authHeader.slice(7));
    c.set('user', { id: Number(payload.sub), email: payload.email, name: payload.name });
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
```

**Per-request cost:** One `HS256` signature verification (~microseconds). Zero DB queries.

Install `jose` library: `pnpm --filter web add jose`

---

## Phase 2: Handler Migration

### 2.1 Update all handlers

Replace `ensureDefaultUser(db)` → `c.get('user')` in every handler file:

| File | Handlers to update |
|------|--------------------|
| `handlers/tasks.ts` | listTasks, getTask, createTask, updateTask, deleteTask |
| `handlers/tags.ts` | listTags, getTag, createTag, updateTag, deleteTag |
| `handlers/timers.ts` | getTaskTimers, createTimer |
| `handlers/comments.ts` | listComments, createComment, getComment, updateComment, deleteComment |
| `handlers/activities.ts` | getTaskActivities |

Pattern change:
```ts
// Before
const defaultUser = await ensureDefaultUser(db)
// After
const user = c.get('user')
```

### 2.2 Delete `ensureDefaultUser`

Remove from `apps/web/app/core/tasks.db.ts` and clean up its imports in all handler files.

### 2.3 Update tests

Update test files to either:
- Mock `auth.api.getSession` to return a test user, OR
- Create a real test user via better-auth sign-up in `beforeAll` and include Bearer token in requests

Update `apps/web/app/db/tests/sqliteLibsqlTestUtils.ts` reset function to also delete from new auth tables.

---

## Phase 3: Electron Client

### 3.1 Install better-auth (electron)

```sh
pnpm --filter electron add better-auth
```

### 3.2 Create auth client

**New file:** `apps/electron/src/renderer/src/lib/auth.ts`

```ts
import { createAuthClient } from "better-auth/client";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const AUTH_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

// better-auth client — for sign-in/sign-up/sign-out only
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  basePath: "/api/auth",
  fetchOptions: {
    onSuccess: (ctx) => {
      // Store session token (long-lived ~7 days, used to refresh JWTs)
      const sessionToken = ctx.response.headers.get("set-auth-token");
      if (sessionToken) {
        localStorage.setItem("session_token", sessionToken);
      }
    },
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem("session_token") || "",
    },
  },
});

// JWT Token Manager
// - Caches short-lived JWT (15 min) for API calls
// - Uses session token to get new JWT from POST /api/token when expired
let jwtToken: string | null = null;
let jwtExpiresAt: number = 0;

export async function getJwt(): Promise<string | null> {
  // Return cached JWT if still valid (with 60s safety buffer)
  if (jwtToken && Date.now() < (jwtExpiresAt - 60_000)) {
    return jwtToken;
  }

  // Exchange session token for a new JWT via custom endpoint
  const sessionToken = localStorage.getItem("session_token");
  if (!sessionToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken}` },
    });
    if (!res.ok) throw new Error('Token exchange failed');

    const { token } = await res.json();
    jwtToken = token;
    jwtExpiresAt = Date.now() + 14 * 60 * 1000; // ~14 min (conservative)
    window.api.updateAuthToken(jwtToken); // Forward JWT to main process via IPC
    return jwtToken;
  } catch {
    // Session expired — need to re-authenticate
    jwtToken = null;
    return null;
  }
}

export function clearAuthState(): void {
  localStorage.removeItem("session_token");
  jwtToken = null;
  jwtExpiresAt = 0;
  window.api.updateAuthToken(null);
}
```

### 3.3 Update mutator with JWT Authorization header

**File:** `apps/electron/src/renderer/src/lib/api/mutator.ts`

Send JWT (not session token) with each API request:
```ts
import { getJwt, clearAuthState } from '../auth';

// Inside customInstance — make it async:
const jwt = await getJwt();
if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

// Handle 401 (JWT expired AND refresh also failed):
if (response.status === 401) {
  clearAuthState();
  throw new Error('Unauthorized');
}
```

**Per-request flow from client perspective:**
1. `getJwt()` → returns cached JWT if valid (<14 min old), or calls `POST /api/token` with session token to get a new JWT (one DB lookup every ~15 min)
2. JWT sent as `Authorization: Bearer <jwt>` → server verifies with `JWT_SECRET` — **zero DB access**
3. On 401 → clear all tokens → redirect to auth screen

### 3.4 Create AuthScreen component

**New file:** `apps/electron/src/renderer/src/components/AuthScreen.tsx`

- Email/password sign-in/sign-up form (toggle modes)
- "Sign in with Google" / "Sign in with GitHub" / "Sign in with Apple" buttons
- Error display

### 3.5 Create useAuth hook

**New file:** `apps/electron/src/renderer/src/hooks/useAuth.ts`

- Check token validity on mount via `authClient.getSession()`
- Expose: `user`, `isAuthenticated`, `isLoading`, `signOut`

### 3.6 Gate app on auth

**File:** `apps/electron/src/renderer/src/main.tsx` (or `App.tsx`)

Show `<AuthScreen />` when not authenticated, `<App />` when authenticated.

### 3.7 Auth token IPC for main process

The main process (TrayManager, NotificationScheduler) makes `fetch()` calls that need auth.

**Preload** (`src/preload/index.ts`): Add `updateAuthToken(token)` that calls `ipcRenderer.send('auth:token-update', token)`.

**Main process** (`src/main/index.ts`):
- `ipcMain.on('auth:token-update', (_, token) => { authToken = token })`
- Export `getAuthToken()` function
- Pass to TrayManager and NotificationScheduler constructors

**Update** `tray.ts` and `notificationScheduler.ts`: Include `Authorization: Bearer <token>` in all `fetch()` calls.

### 3.8 OAuth popup flow for Electron

For social login in Electron:
- Open a new `BrowserWindow` pointing to the OAuth provider URL
- Intercept the callback redirect to extract the session token
- Add `auth:social-sign-in` IPC handler in main process

### 3.9 Update CSP

**File:** `apps/electron/src/main/index.ts` — `setupContentSecurityPolicy()`

Add OAuth provider domains to `connect-src` and provider image domains to `img-src`:
```
connect-src: ... https://accounts.google.com https://github.com https://appleid.apple.com
img-src: 'self' data: https://*.googleusercontent.com https://avatars.githubusercontent.com
```

---

## Phase 4: Production Migration

1. `pnpm --filter web run drizzle:generate:prod` — generates migration SQL
2. Review migration (ALTER TABLE users ADD COLUMN + CREATE TABLE for auth tables)
3. `pnpm --filter web run drizzle:migrate:prod` — apply to Turso
4. Set production env vars (BETTER_AUTH_SECRET, JWT_SECRET, OAuth credentials)

---

## Critical Files

| File | Changes |
|------|---------|
| `apps/web/app/db/schema/schema.ts` | Extend usersTable, add 3 auth tables (sessions, accounts, verifications) |
| `apps/web/app/core/common.db.ts` | Make getDb() singleton |
| `apps/web/app/core/auth.ts` | **NEW** — better-auth config |
| `apps/web/app/core/jwt.ts` | **NEW** — JWT sign/verify using `jose` + `JWT_SECRET` env var |
| `apps/web/app/api/[[...route]]/route.ts` | Mount auth handler, add JWT middleware, add token exchange endpoint |
| `apps/web/app/api/[[...route]]/handlers/*.ts` | Replace ensureDefaultUser → c.get('user') |
| `apps/web/app/core/tasks.db.ts` | Delete ensureDefaultUser |
| `apps/electron/src/renderer/src/lib/auth.ts` | **NEW** — auth client + JWT token manager |
| `apps/electron/src/renderer/src/lib/api/mutator.ts` | Add JWT Bearer token header |
| `apps/electron/src/renderer/src/components/AuthScreen.tsx` | **NEW** — login/signup UI |
| `apps/electron/src/renderer/src/hooks/useAuth.ts` | **NEW** — auth state hook |
| `apps/electron/src/preload/index.ts` | Add auth token IPC |
| `apps/electron/src/main/index.ts` | Auth token IPC handler, CSP update |
| `apps/electron/src/main/tray.ts` | Add auth headers to fetch |
| `apps/electron/src/main/notificationScheduler.ts` | Add auth headers to fetch |

---

## Verification

1. **Server auth flow**: `POST /api/auth/sign-up/email` → returns session token → `POST /api/token` with `Authorization: Bearer <session-token>` → returns JWT → `GET /api/tasks` with `Authorization: Bearer <jwt>` → 200 OK
2. **Unauthorized access**: `GET /api/tasks` without JWT → 401
3. **JWT expiry**: Wait 15+ min → API request fails → client auto-refreshes JWT via `POST /api/token` using session token → works again
4. **Electron flow**: Launch app → auth screen → sign up → JWT auto-obtained → main app loads → tasks/timers work → close/reopen → session persists (JWT refreshed from session token)
5. **Main process**: Tray and notifications continue working with JWT forwarded via IPC
6. Run `pnpm run check-types` and `pnpm run test`
