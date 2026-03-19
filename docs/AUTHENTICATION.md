---
title: "Authentication"
brief_description: "Techoo uses a **hybrid session + JWT** architecture. A long-lived session token (~7 days) is exchanged for a short-lived JWT (~15 min) that is sent with every API request. The JWT is verified server-side with zero database access (HMAC-SHA256 via `jose`)."
created_at: "2026-02-21"
update_at: "2026-02-21"
---

# Authentication

Techoo uses a **hybrid session + JWT** architecture. A long-lived session token (managed by better-auth defaults) is exchanged for a short-lived JWT (~15 min) that is sent with every API request. The JWT is verified server-side with zero database access (HMAC-SHA256 via `jose`).

## Token Architecture

| Token | Lifetime | Stored in | Used for | DB access on use |
|-------|----------|-----------|----------|------------------|
| Session token | better-auth default | Client persistent storage | Refreshing JWTs via `POST /api/token` | Yes (1 lookup per refresh) |
| JWT | 15 min | Client memory (cache) | All API requests (`Authorization: Bearer`) | No (stateless verification) |

## Server-Side

**Key files** (all under `apps/backend/src/app/`):

- `core/auth.ts` — better-auth configuration (email/password + Google OAuth, bearer plugin, Drizzle adapter)
- `core/jwt.ts` — JWT sign/verify using `jose` + `JWT_SECRET` env var (HS256)
- `api/[[...route]]/route.ts` — Auth endpoints, JWT middleware, OAuth flows

**Public endpoints** (skip JWT middleware):

| Endpoint | Purpose |
|----------|---------|
| `POST,GET /api/auth/*` | better-auth (sign-up, sign-in, sign-out, OAuth callbacks) |
| `POST /api/token` | Exchange session token for JWT, or exchange short-lived code for session token + JWT |
| `GET /api/session` | Look up user info from session token |
| `POST /api/session-code` | Create short-lived code from session token |
| `GET /api/oauth/desktop` | Desktop OAuth initiation |
| `GET /api/oauth/desktop/callback` | Desktop OAuth callback |
| `GET /api/oauth/desktop-link` | Desktop account linking (e.g. add Google to existing account) |
| `GET /api/oauth/mobile` | Mobile OAuth initiation |
| `GET /api/oauth/mobile/callback` | Mobile OAuth callback |
| `GET /api/oauth/mobile-link` | Mobile account linking |
| `GET /api/oauth/mobile-link/callback` | Mobile account linking callback |
| `POST /api/webhooks/*` | Google Calendar push notifications |
| `GET /api/health`, `GET /api/doc` | Public info |

**Protected endpoints** require `Authorization: Bearer <jwt>` header. The middleware verifies the JWT signature and sets `c.set('user', { id, email, name })` for handlers.

## Client Authentication Flows

Both Electron and Mobile follow the same core pattern:

1. User authenticates (email/password or OAuth) → receives session token
2. Client stores session token persistently
3. Client exchanges session token for JWT via `POST /api/token`
4. Client caches JWT in memory (~14 min conservative expiry)
5. Every API request includes `Authorization: Bearer <jwt>`
6. When JWT expires, client auto-refreshes from session token
7. On 401 response, client clears all auth state → redirect to login

### Differences Between Electron and Mobile

| Aspect | Electron | Mobile |
|--------|----------|--------|
| **Session token storage** | Main process secure storage (`safeStorage`) | `expo-secure-store` (encrypted) |
| **JWT cache** | In-memory variable | In-memory variable |
| **Auth client library** | `better-auth/client` (`createAuthClient`) | Raw `fetch` calls to auth endpoints |
| **OAuth mechanism** | System browser + loopback HTTP server on `127.0.0.1` | `expo-web-browser` (`openAuthSessionAsync`) + deep link |
| **OAuth redirect target** | `http://127.0.0.1:<port>/callback?code=...` | `<app-deep-link>?code=...` (e.g. `exp+techoo://auth-callback` in dev, `techoo://auth-callback` in prod) |
| **OAuth server endpoints** | `GET /api/oauth/desktop?provider=...&port=...` → `GET /api/oauth/desktop/callback?port=...` | `GET /api/oauth/mobile?provider=...&redirect_uri=...` → `GET /api/oauth/mobile/callback?redirect_uri=...` |
| **Main process auth** | JWT forwarded via IPC (`auth:token-update`) to tray/notifications | N/A |
| **Auth guard** | `AuthGate` component wrapping `App` | Expo Router `Redirect` in `(tabs)/_layout.tsx` |
| **Sign-out** | `authClient.signOut()` + `clearAuthState()` | `clearAuthState()` only (no server call) |

### Electron OAuth Flow

```
Renderer                    Main Process                 Server                    System Browser
  |                              |                          |                            |
  |-- signInWithOAuth('google') -->                         |                            |
  |                              |-- start loopback :PORT   |                            |
  |                              |-- shell.openExternal() --+---------------------------->|
  |                              |                          | GET /oauth/desktop          |
  |                              |                          |   ?provider=google          |
  |                              |                          |   &port=PORT                |
  |                              |                          |<----------------------------|
  |                              |                          |-- internal auth.handler()   |
  |                              |                          |-- 302 + state cookie ------>|
  |                              |                          |                    Google login
  |                              |                          |<--- /auth/callback ---------|
  |                              |                          |-- create session + cookie   |
  |                              |                          |-- 302 /oauth/desktop/callback|
  |                              |                          |-- read cookie, create code  |
  |                              |                          |-- 302 127.0.0.1:PORT ------>|
  |                              |<-- /callback?code=... ---|                             |
  |                              |-- resolve promise        |                             |
  |<-- code ---------------------|                          |                             |
  |-- POST /api/token {code} -->|                          |                             |
  |<-- { token, session_token } |                          |                             |
  |-- persist session_token     |                          |                             |
```

**Why a loopback server?** Electron runs as a native app with no registered URL scheme in dev. A temporary HTTP server on localhost receives the OAuth callback directly.

### Mobile OAuth Flow

```
Mobile App                              Server                         System Browser
  |                                        |                                |
  |-- openAuthSessionAsync() ------------->|                                |
  |   url: /oauth/mobile                   |                                |
  |     ?provider=google                   |                                |
  |     &redirect_uri=exp+techoo://...     |                                |
  |                                        | GET /oauth/mobile              |
  |                                        |<-------------------------------|
  |                                        |-- internal auth.handler()      |
  |                                        |-- 302 + state cookie --------->|
  |                                        |                       Google login
  |                                        |<--- /auth/callback ------------|
  |                                        |-- create session + cookie      |
  |                                        |-- 302 /oauth/mobile/callback   |
  |                                        |     ?redirect_uri=...          |
  |                                        |-- read cookie, create code     |
  |                                        |-- 302 redirect_uri+code ------>|
  |<-- intercepted by openAuthSessionAsync |                                |
  |   result.url has code                  |                                |
  |-- POST /api/token {code} ------------>|                                |
  |<-- { token, session_token }            |                                |
  |-- SecureStore.set(session_token)       |                                |
```

**Why `redirect_uri` is passed dynamically:** Expo's deep link URL varies by environment — `exp+techoo://auth-callback` in Expo Go, `techoo://auth-callback` in production builds. The mobile app passes its actual URL via `Linking.createURL()` so the backend redirects to the correct scheme. The backend validates this against `MOBILE_REDIRECT_URIS`.

**Why `openAuthSessionAsync`?** It uses `ASWebAuthenticationSession` (iOS) / Chrome Custom Tabs (Android), which intercepts the redirect to the app's URL scheme and returns it to the app without Safari needing to actually "open" the deep link.

## Key Files

### Backend
| File | Purpose |
|------|---------|
| `apps/backend/src/app/core/auth.ts` | better-auth config (providers, plugins, DB adapter) |
| `apps/backend/src/app/core/jwt.ts` | JWT sign/verify (HS256, 15min expiry) |
| `apps/backend/src/app/api/[[...route]]/route.ts` | Auth endpoints, OAuth flows, JWT middleware |

### Electron
| File | Purpose |
|------|---------|
| `apps/electron/src/renderer/src/lib/auth.ts` | `createAuthClient`, JWT cache, `getJwt()`, `clearAuthState()` |
| `apps/electron/src/renderer/src/lib/api/mutator.ts` | Attaches JWT Bearer header, handles 401 |
| `apps/electron/src/renderer/src/hooks/useAuth.ts` | `useAuth()` hook — user state, sign-out |
| `apps/electron/src/renderer/src/components/AuthScreen.tsx` | Sign-in/sign-up form + OAuth buttons |
| `apps/electron/src/renderer/src/components/AuthGate.tsx` | Auth guard wrapping the app |
| `apps/electron/src/main/index.ts` | OAuth loopback server, IPC handlers |
| `apps/electron/src/preload/index.ts` | `updateAuthToken()`, `signInWithOAuth()` IPC bridge |

### Mobile
| File | Purpose |
|------|---------|
| `apps/mobile/lib/auth.ts` | SecureStore session storage, JWT cache, `getJwt()`, email sign-in/sign-up |
| `apps/mobile/lib/oauth.ts` | `signInWithGoogle()` via `expo-web-browser` |
| `apps/mobile/lib/api/mutator.ts` | Attaches JWT Bearer header, handles 401 |
| `apps/mobile/hooks/useAuth.ts` | `AuthContext`, `useAuth()`, `useAuthProvider()` |
| `apps/mobile/components/auth/AuthScreen.tsx` | Sign-in/sign-up form + Google OAuth button |
| `apps/mobile/app/auth.tsx` | Auth route (redirects to tabs if authenticated) |
| `apps/mobile/app/_layout.tsx` | Wraps app with `AuthContext.Provider` |
| `apps/mobile/app/(tabs)/_layout.tsx` | Auth guard — redirects to `/auth` if unauthenticated |
| `apps/mobile/components/settings/SettingsContent.tsx` | Account card with sign-out button |

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `BETTER_AUTH_SECRET` | Backend | better-auth internal secret (32+ chars) |
| `BETTER_AUTH_URL` | Backend | Base URL for auth (e.g. `http://localhost:8787`) |
| `JWT_SECRET` | Backend | HMAC-SHA256 signing key (32+ chars) |
| `TRUSTED_ORIGINS` | Backend | Comma-separated CSRF-allowed origins |
| `GOOGLE_CLIENT_ID` | Backend | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | Google OAuth client secret |
| `VITE_API_BASE_URL` | Electron | API base URL for renderer |
| `MAIN_VITE_API_BASE_URL` | Electron | API base URL for main process |
| `API_URL` | Mobile | API base URL (via `.env.local` → `app.config.js` → `Constants.expoConfig.extra.apiUrl`) |
