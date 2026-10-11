---
date: 2026-09-06
status: accepted
branch: cursor/fix-electron-session-expiry-47a6
---

# Fix Electron spurious "session expired" sign-out

## Context

The desktop app frequently bounced users to sign-in with:

> Your session expired or is no longer valid. Please sign in again.

That copy is shown only when the renderer emits `SESSION_INVALID_REASON.API_UNAUTHORIZED`. Techoo uses a hybrid auth model: a long-lived better-auth session token (30 days, persisted via Electron `safeStorage`) is exchanged for a 15-minute JWT. The JWT is memory-only.

Constraints:

- `/api/token` and `/api/session` return **401** (not 404) when the session token is missing/invalid. JWT middleware also returns 401 for a bad/expired JWT.
- Several Google Calendar routes return **401** when *Google* OAuth is expired (`GOOGLE_TOKEN_EXPIRED`). That is not a Techoo session failure.
- The JWT cache does not survive process exit; relaunch must exchange the stored session token again.

## Decision

### What was going wrong

1. **No 401 → refresh → retry.** `customInstance` treated every API 401 as a dead session and called `invalidateAuthSession` immediately. It never tried `POST /api/token` with the stored session token first. An expired JWT (clock skew, cache edge) therefore signed the user out even though the session token was still valid.
2. **Google 401s looked like Techoo 401s.** Calendar auto-sync / available-calendar calls can 401 with `GOOGLE_TOKEN_EXPIRED`. That wiped the Techoo session and showed the same banner.
3. **`getJwt()` wiped the session on any failure.** Network errors, Worker 5xx, and parse failures all called `invalidateAuthSession`. A single blip during the ~13-minute refresh then sent the following API request *without* a JWT; the resulting 401 overwrote the reason with `API_UNAUTHORIZED` (the message users reported).
4. **Startup session check was brittle.** After a successful token exchange, `useAuth` still called `GET /api/session` with the session token and invalidated on any non-OK (including transients). JWT is already proof of a valid session.

### What we changed

- **401 retry:** on API 401, force-refresh the JWT from the session token and retry the request once. Do **not** clear credentials from `customInstance`.
- **Session death is `/api/token` 401/403 only.** Transient `/token` failures keep the stored session so relaunch and later calls can recover.
- **Relaunch refresh:** JWT cache starts empty; `getJwt()` / `useAuth` exchange the persisted session token. User identity is read from the JWT (`userFromJwt`), matching mobile — no extra `/api/session` round trip.
- **Single-flight refresh** so concurrent API calls share one `/token` request.

Rejected alternatives:

- Logging out on every 401 (status quo) — conflates JWT expiry, Google OAuth, and Techoo session.
- Retrying on 404 — domain 404s (missing todo/note) are not auth; `/token` and `/session` already use 401.
- Persisting the JWT to disk — unnecessary if session-token exchange on launch is reliable; short-lived JWTs should stay in memory.

## Consequences

- Users stay signed in across JWT expiry, brief API outages, and Google-token problems.
- Google Calendar 401s surface as calendar errors instead of a global sign-in wall.
- A truly revoked/expired session token still signs the user out, via `/api/token` 401, with "Could not refresh your session."
- Main-process tray/notifications still depend on the renderer pushing a JWT after refresh; they do not independently persist JWTs (unchanged).
