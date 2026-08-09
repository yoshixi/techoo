---
date: 2026-08-08
status: Accepted
branch: calender-feature
---

# Calendar Sync Lifecycle (stale-on-open)

## Context

Calendar events were only imported on explicit user actions (Add calendar / Sync). That left the calendar UI stale unless the user remembered to sync, while background/cron sync would burn Google API quota for inactive users.

## Decision

**Phase 1 (implemented):** Sync-if-stale when the user opens a calendar surface.

- Stale threshold: 15 minutes (`lastSyncedAt` null or older).
- Triggers: mobile `CalendarView`; Electron `CalendarTodoWorkspace` and Today plan mode.
- Also re-check on foreground/focus while those surfaces are mounted.
- Debounce: 60s + in-flight guard (module-scoped across hook instances).
- Call `POST /api/calendars/sync` for all enabled calendars; fire-and-forget; silent failure (Settings Sync remains).

**Phase 2 (deferred):** Google push watch auto-start + Cloudflare Cron channel renewal; keep stale-on-open as fallback.

## Consequences

- Inactive users incur no sync cost.
- Active calendar users get fresh-enough data without a Sync tap.
- Sync remains synchronous and still imports only the next 30 days (separate TODO).
- Near real-time updates still require Phase 2 watch/webhooks.
