---
date: 2026-08-10
status: proposed
branch: calender-feature
---

# Calendar / events API → `/api/v1` (+ optional naming alignment)

## Context

Techoo’s Hono app is mounted at `basePath('/api')`. Domain resources added earlier use an explicit version segment:

| Surface | Current paths |
|---|---|
| Todos / posts / notes / post-lists | `/api/v1/...` |
| Calendars / events | `/api/calendars`, `/api/events` (no `v1`) |
| Auth / session / oauth / health / account / webhooks | `/api/...` (intentionally unversioned) |

Clients (mobile, electron) are first-party and generated from OpenAPI, so a path rename is mechanical — but docs, tests, and any hardcoded URLs must move with it.

Separately, `TODO.md` already notes an **API field naming** split: todos/posts use snake_case (`starts_at`); calendars/events use camelCase (`startAt`). That is independent of the path prefix but is a natural companion cleanup.

Constraints:

- No DB schema change for either migration (columns are already snake_case via Drizzle).
- Cloudflare Workers deploy on merge; old paths break clients until regenerated apps ship.
- Prefer one coordinated cutover over long dual-path support unless desktop/mobile release lag requires aliases.

## Decision

### Phase A — Path prefix (do this)

Move **calendar and event** OpenAPI routes under `/v1`:

| Current | New |
|---|---|
| `/api/calendars` (+ `available`, `{id}`, sync, watch) | `/api/v1/calendars` (+ same suffixes) |
| `/api/events` (+ `{id}`) | `/api/v1/events` (+ `{id}`) |

Leave **unversioned**: `/api/auth/*`, `/api/oauth/*`, `/api/session*`, `/api/health`, `/api/account`, `/api/webhooks/*`, `/api/token`.

**Cutover strategy (preferred):** single PR — change route `path:` values, regenerate OpenAPI + mobile/electron clients, update docs/tests. No long-lived aliases unless a released desktop build still needs them.

**If a published Electron build must keep working:** temporarily register both old and new paths pointing at the same handlers for one release, then remove aliases.

### Phase B — Field naming (optional, same or follow-up PR)

Align calendar/event (and related oauth calendar payloads if desired) JSON fields to **snake_case** to match todos/posts:

- Examples: `startAt` → `starts_at` or keep event-domain `start_at` / `end_at` (decide one pair and document); `lastSyncedAt` → `last_synced_at`; `calendarId` → `calendar_id`; `isAllDay` → `is_all_day`; etc.
- Update Zod OpenAPI schemas in `*.core.ts`, regenerate clients, fix UI usages.
- Do **not** rename DB columns.

Rejected for Phase B: force todos to camelCase — more call sites and worse consistency with SQLite/Drizzle mental model.

### Out of scope

- Calendar sync window product decision (`now → +30 days`)
- Phase 2 watch/cron
- Versioning oauth under `/v1`

## Implementation checklist

1. **Backend routes** — in `routes/calendars.ts` and `routes/events.ts`, change `path: '/calendars…'` / `'/events…'` → `'/v1/calendars…'` / `'/v1/events…'`.
2. **Backend tests** — update request URLs in handler/integration tests that hit calendars/events.
3. **OpenAPI regenerate** — `pnpm --filter electron run api:generate` (and mobile `api:generate` if separate).
4. **Clients** — confirm generated paths; fix any hardcoded `/api/calendars` or `/api/events` strings (docs, hooks comments, SWR key matchers that assume exact path — matchers using `key[0] === '/api/events'` must become `'/api/v1/events'`).
5. **Docs** — `docs/GOOGLE_CALENDAR_INTEGRATION.md`, `docs/MULTI_ACCOUNT_CALENDAR_LINKING.md`, any ADRs that cite old paths.
6. **Verify** — `pnpm run check-types`; backend vitest for calendar/event handlers; smoke mobile Schedule + settings calendar toggles; electron Account/Calendar views.
7. **Ship** — merge backend first or same monorepo commit so Workers and clients stay in lockstep; if Electron is versioned separately, use aliases or ship desktop immediately after.

## Consequences

- **Pros:** Consistent versioning for all domain CRUD; clearer “v1 surface” for future breaking changes; pairs cleanly with snake_case alignment.
- **Cons:** Short breakage window if a client isn’t regenerated; SWR cache keys change (cold cache once — fine).
- **Rejected:** Leaving calendars unversioned forever — increases onboarding confusion for no benefit while APIs are still private.
- **Rejected:** Putting oauth under `/v1` in the same change — different lifecycle (better-auth callbacks / redirect URIs).

## Follow-ups

- Remove path aliases if introduced for Electron lag.
- Update `TODO.md` API naming item when Phase B lands (or link this ADR).
