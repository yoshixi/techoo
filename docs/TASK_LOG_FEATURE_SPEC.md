# Task Log Feature Specification

## Objective
- Allow task owners to attach contextual logs (text notes, blockers, recap) alongside focus timers.
- Maintain a unified timeline so timers and logs reinforce each other rather than feeling like separate subsystems.

## User & UX Goals
- **Fast capture:** User should be able to add a log while starting, stopping, or reviewing a timer with minimal context switching.
- **Single timeline:** Timers and logs need to live in one chronological narrative per task so the user can read the history without hopping tabs.
- **Status awareness:** Logs should inherit enough metadata (precise timestamps, task context) so downstream summaries can infer “what happened during this focus window” without storing explicit timer IDs.

## UX Recommendations
1. **Timeline layout:** Within a task detail view, show a vertical timeline sorted by start-time DESC that interleaves focus timers and log entries. Timers render as duration blocks; logs render as note cards with optional timer badges.
2. **Inline composer:** Provide one composer anchored below the active timer widget. When a timer is running or stopped, the composer offers:
   - “Add log for current timer” (pre-fills a helper message referencing the running timer but only stores the log timestamp).
   - “Add general log” (free note, always stored with the current timestamp).
3. **Quick prompts:** Offer short prompt chips (“What did you complete?”, “Any blockers?”) so the user can log thoughts rapidly.
4. **Empty state:** If a task has timers but no logs, surface a call-to-action under the timer list to encourage adding context.
5. **Editing:** Allow inline editing/deleting of logs since they are similar to comments but with stronger temporal semantics.

## Data Model

### Table Naming Considerations
- `task_comments`: Familiar CRUD mental model, consistent with REST URLs (comments endpoints) while still representing structured progress logs.
- `task_posts`: Too generic and could conflict with any future public sharing feature.
- `task_logs`: Communicates intent but mismatches the requested endpoint naming.

**Recommendation:** Create a `task_comments` table (UX can still call them logs/notes).

### Proposed Schema (`task_comments`)
| Column           | Type                | Notes |
|------------------|---------------------|-------|
| `id`             | UUID v7 (PK)        | Matches existing ID strategy. |
| `task_id`        | UUID (FK tasks.id)  | Required, cascades on delete. |
| `body`           | TEXT                | Markdown/plain text body (1–2000 chars). |
| `created_at`     | DATETIME            | Default `CURRENT_TIMESTAMP`. |
| `updated_at`     | DATETIME            | For edits; nullable until first edit. |
| `author_id`      | UUID (FK users.id)  | Defaults to the single-user context today, future-proofed for multi-user. |

Indexes:
- `(task_id, created_at DESC)` for per-task timeline queries.

## API Touchpoints
- **CRUD for comments:**
  - `POST /api/tasks/:taskId/comments` accepts `{ body }`.
  - `GET /api/tasks/:taskId/comments` returns paginated `task_comments` ordered by `created_at DESC`.
  - `PATCH /api/tasks/:taskId/comments/:commentId` allows editing the body.
  - `DELETE /api/tasks/:taskId/comments/:commentId`.
- **Unified activity feed:** `GET /api/tasks/:taskId/activities` returns both timers and comments sorted by their timestamps (newest first). Timers use `started_at` (or `ended_at` fallback) while comments use `created_at`, so the API must normalize those values before sorting. Response rows look like:
  ```json
  [
    { "type": "timer", "data": { ...timer fields... } },
    { "type": "comment", "data": { ...comment fields... } }
  ]
  ```
  Client renders these directly in the timeline UI.
- **Validation:** Reuse Zod patterns (string length, UUID). API only needs to ensure that the task exists and the body meets requirements.

## UX Flow with Timer
1. User starts a timer.
2. When stopping, the completion dialog includes a textarea “What did you accomplish?”; submitting creates both the timer entry and an optional log (created within the timer’s end window). Clients can correlate logs to timers by comparing timestamps.
3. If the user adds a log mid-session, the composer captures the current timestamp so clients can infer which timer window it belongs to if needed.

## Implementation Notes
- Extend Drizzle schema and run migration to add `task_comments`.
- Update `apps/web/app/core/tasks.core.ts` (or equivalent) to aggregate timers and comments before returning to the client and to build the `/activities` response.
- Frontend should normalize timeline items: `{ type: 'timer', data: FocusTimer } | { type: 'comment', data: TaskComment }`.
- Electron/desktop clients can mirror the same API; no extra store layer is required if they already fetch task detail JSON.

## Open Questions
- Do logs need attachments or emoji reactions? (Not in v1; keep body text-only.)
- Should editing logs affect related timer summaries? (Probably no; treat as separate audit trail.)
- Are logs private per user in a shared task? Need confirmation if multi-user support is on the roadmap.
