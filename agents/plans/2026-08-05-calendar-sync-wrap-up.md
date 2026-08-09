---
date: 2026-08-05
status: Accepted
branch: calender-feature
---

# Calendar Sync Wrap-up

## Context

Google OAuth already requested Calendar scopes, and the backend exposed calendar CRUD/sync APIs, but users saw no events:

- Mobile Settings showed “No calendars found” when `GET /calendars/available` failed (token/Calendar API/scopes), because errors were treated as an empty list.
- Adding a calendar did not sync events until a separate Sync tap.
- Electron could link Google accounts but had no Available/Synced calendar UI and never passed events into `CalendarView`.

## Decision

1. **Actionable Google errors** — Map Calendar API / token / scope failures to clear API `error` + `code` values; surface them in mobile/Electron Settings with a re-link CTA.
2. **OAuth reliability** — better-auth Google provider uses `prompt: 'select_account consent'` with offline access; status endpoint refreshes tokens and reports `hasCalendarScope`.
3. **Auto-sync on add** — `POST /calendars` imports the next 30 days of events after insert.
4. **Electron parity** — Restore Available/Synced calendar management in `AccountView`; wire `useCalendarEvents` into Todo calendar and Today plan mode; add a light visibility filter.

## Consequences

- Users must still **Add** calendars after OAuth; permission alone does not import events (documented).
- Google Cloud projects must enable the **Google Calendar API** or Available Calendars fails with an explicit message.
- Watch renewal / incremental sync remain out of scope.
- OpenAPI clients need regeneration (or manual schema updates) for `OAuthStatusResponse.hasCalendarScope` / `scope`.
