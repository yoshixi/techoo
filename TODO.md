## New features

- Calendar integration
- Calendar sync Phase 2 — auto-start Google watch on calendar add (when `WEBHOOK_BASE_URL` is set); Cloudflare Cron to renew expiring channels; stop Google channels on delete/disconnect. Keep sync-if-stale as fallback for local/dev. See `agents/plans/2026-08-08-calendar-sync-lifecycle.md`.

## Bugs / small improvements

- Calendar sync date range — today imports only `now → +30 days` (full replace, no past). Users can navigate any date in the UI, so the right window (past/future, per-view sync, incremental) needs a deliberate product decision later.
- API field naming inconsistency — todos/posts/notes use snake_case (`starts_at`); calendars/events/oauth use camelCase (`startAt`, `lastSyncedAt`). Pick one convention and align OpenAPI models + clients. **No DB schema change required** — SQLite columns are already snake_case; Drizzle maps them in JS. This is an API/response + generated-client migration only.

## Operation improvements

- Agent doc validation — ensure doc markdowns have expected metadata

## For GA

- Ops — LP creation
- Ops — make OAuth client ready (currently using a private OAuth client that only allows limited email users)
