# Techo Product Revamp Plan

## Context

Techoo (a task/time-tracking app) is being revamped into **Techo** — an AI-era digital planner based on the philosophy "one day = one Markdown file." The product doc is at `docs/techo_product_doc.docx`. This is a big-bang rebuild on a feature branch, keeping auth/multi-tenant/infra and rebuilding the domain layer (schema, APIs, UI).

### Design Decisions
- **User IDs**: Keep integer (better-auth compatible). New domain entities use TEXT UUIDs.
- **API base path**: `/api/v1` for domain routes. Auth routes stay at `/api/auth`.
- **Google Calendar**: Keep existing calendar infrastructure (calendars, calendar_events, watch_channels tables). Map to new events concept.
- **Approach**: Big bang on a feature branch (`techo-revamp`).

---

## What We Keep (No Changes)

- Auth system: better-auth, JWT, Google OAuth (`core/auth.ts`, `core/jwt.ts`, middleware/*)
- Multi-tenant: tenanso, per-user DBs (`core/common.db.ts`)
- Middleware stack: logger, CORS, JWT auth, better-auth middleware
- Google OAuth handlers: `handlers/google-auth.ts`, `routes/google-auth.ts`
- OAuth service: `core/oauth.service.ts`, `core/oauth.db.ts`
- Auth handlers: `handlers/auth.ts` (token, session, session-code), `handlers/account.ts`
- Health endpoint
- Electron shell: main process, preload, IPC
- UI component library: all 18 shadcn/ui components in `components/ui/`
- API client pipeline: Orval + SWR + mutator
- Auth components: AuthGate, AuthScreen, useAuth hook

## What We Rebuild

### Phase 1: Database Schema

**File**: `apps/backend/src/app/db/schema/schema.ts`

**Add `timezone` to users table** (for tenant DB copy):
```
timezone: text('timezone')  // e.g. 'Asia/Tokyo'
```

**Delete tables**: `tasksTable`, `taskTimersTable`, `taskCommentsTable`, `tagsTable`, `taskTagsTable`, `noteTaskConversionsTable`
- Keep: `calendarsTable`, `calendarEventsTable`, `calendarWatchChannelsTable` (reused for GCal)
- Keep: all auth tables (users, sessions, accounts, verifications, oauthExchangeCodes)

**New tables** (TEXT UUID PKs, INTEGER Unix timestamps):

| Table | Columns |
|-------|---------|
| `todosTable` | id (TEXT PK), user_id (INT FK), title, starts_at?, ends_at?, is_all_day (INT bool), done (INT bool), done_at?, created_at |
| `postsTable` | id (TEXT PK), user_id (INT FK), body, posted_at |
| `postEventsTable` | post_id (TEXT FK), event_id (INT FK) — composite PK. References `calendarEventsTable.id` |
| `postTodosTable` | post_id (TEXT FK), todo_id (TEXT FK) — composite PK |
| `notesTable` (rewrite) | id (TEXT PK), user_id (INT FK), title, body?, pinned (INT bool), created_at, updated_at |

**Notes on events**: We reuse `calendarEventsTable` as the events source. The product doc's "events" concept maps to calendar_events synced from Google Calendar. No new events table needed — just new API routes that query `calendarEventsTable`.

**Todo ordering**: `ORDER BY starts_at NULLS LAST, created_at`. No manual reorder — no sort_order column.

**Indexes**: `todos_starts_at_idx`, `todos_user_id_done_idx`, `posts_posted_at_idx` (keep existing notes indexes)

**Update type exports**: Remove old Insert/Select types for tasks/timers/tags/comments. Add new ones for todos, posts, post_events, post_todos, notes.

**Update seed in `provisionTenant`**: Add timezone field to user seed.

### Phase 2: Backend Core Layer

Follow existing pattern: `.core.ts` (Zod schemas + types) + `.db.ts` (Drizzle queries).

#### 2a. Todos
- **`core/todos.core.ts`**: TodoModel, CreateTodoModel, UpdateTodoModel, TodoQueryParamsModel (from/to, done filter)
- **`core/todos.db.ts`**: getTodosByRange (ORDER BY starts_at NULLS LAST, created_at), getIncompleteTodos, createTodo, updateTodo, deleteTodo

#### 2b. Posts
- **`core/posts.core.ts`**: PostModel (with nested events[] and todos[]), CreatePostModel (event_ids[], todo_ids[]), UpdatePostModel
- **`core/posts.db.ts`**: getPostsByRange (joins post_events/post_todos), createPost (transactional insert into posts + junction tables), updatePost, deletePost

#### 2c. Notes (rewrite)
- **`core/notes.core.ts`**: NoteModel (id: uuid, title, body, pinned, created_at, updated_at), CreateNoteModel, UpdateNoteModel. Remove archive/convert-to-task models.
- **`core/notes.db.ts`**: Rewrite for new schema. Pinned-first sorting. Remove archive/conversion functions.

#### 2d. Events (thin wrapper over existing calendar_events)
- **`core/events.core.ts`**: EventModel (maps from calendarEventsTable), EventQueryParamsModel (from/to)
- **`core/events.db.ts`**: getEventsByRange (queries calendarEventsTable with time range filter)

#### 2e. User update
- Add `UpdateUserModel` (timezone field) to existing auth core or new `core/users.core.ts`
- Add `updateUser(db, userId, data)` function

### Phase 3: Backend API Layer

**Base path**: New domain routes use `/api/v1` prefix. Create a sub-app or use `.basePath('/api/v1')` for domain routes.

#### Delete old route/handler files:
- `routes/`: tasks.ts, timers.ts, tags.ts, comments.ts, activities.ts
- `handlers/`: tasks.ts, timers.ts, tags.ts, comments.ts, activities.ts
- `core/`: tasks.*.ts, timers.*.ts, tags.*.ts, comments.*.ts, activities.*.ts

#### Keep:
- `routes/`: calendars.ts, events.ts (existing), google-auth.ts, auth.ts, account.ts, health.ts, webhooks.ts, notes.ts (will rewrite)
- `handlers/`: same set as routes

#### New/rewritten route files (in `routes/`):
- `todos.ts` — GET /v1/todos, POST /v1/todos, PATCH /v1/todos/:id, DELETE /v1/todos/:id
- `posts.ts` — GET /v1/posts, POST /v1/posts, PATCH /v1/posts/:id, DELETE /v1/posts/:id
- `notes.ts` — Rewrite: GET /v1/notes, GET /v1/notes/:id, POST /v1/notes, PATCH /v1/notes/:id, DELETE /v1/notes/:id
- `events.ts` — Rewrite: GET /v1/events (wraps calendar_events query), GET /v1/events/sync
- `auth.ts` — Add PATCH /v1/auth/me (update timezone/name)

#### New handler files (in `handlers/`):
- `todos.ts`, `posts.ts`, `notes.ts` (rewrite), `events.ts` (rewrite)

#### Update `route.ts`:
- Remove old task/timer/tag/comment/activity route registrations
- Add new todo/post/note/event/export route registrations under `/api/v1`
- Update OpenAPI doc title from "Techoo API" to "Techo API"

### Phase 4: Frontend - API Client Regeneration

1. Start backend dev server to expose new OpenAPI spec at `/api/doc`
2. Run `pnpm --filter electron run api:generate`
3. New types and SWR hooks generated for todos, posts, notes, events

### Phase 5: Frontend - Hooks

#### Delete:
- `hooks/useTasksData.ts`, `hooks/useTaskComments.ts`, `hooks/useCalendarSettings.ts`

#### Keep:
- `hooks/useAuth.ts`, `hooks/useCalendarEvents.ts` (may need minor updates), `hooks/use-mobile.ts`

#### New hooks:
- **`hooks/useTodos.ts`** — SWR fetch todos by range or incomplete, mutation helpers (create, update, delete, toggle done)
- **`hooks/usePosts.ts`** — SWR fetch posts by range, create/update/delete, context derivation (find current event/todo by time)
- **`hooks/useNotes.ts`** — Rewrite of useNotesData for new schema (pinned, no archive)
- **`hooks/useEvents.ts`** — SWR fetch events by range (wraps calendar events)

### Phase 6: Frontend - UI Screens

**Build order** (dependencies flow: Events+Todos -> Posts -> Today):

#### 6a. Update Sidebar (`components/Sidebar.tsx`)
- Change View type: `'today' | 'calendar' | 'posts' | 'todo' | 'notes' | 'account'`
- Update menu items with new icons/labels
- Remove InProgressPanel (timer-based)
- Rename "Techoo" to "Techo"

#### 6b. Notes screen (`components/NotesView.tsx`) — rewrite
- Split-pane: note list (left) + markdown editor (right)
- Pinned notes at top, sorted by updated_at desc
- Auto-save with 800ms debounce
- New component: `MarkdownEditor.tsx` (textarea-based, debounced onChange)

#### 6c. ToDo screen (`components/TodoView.tsx`) — new
- Primary: today's todos ordered by starts_at (nulls last), then created_at
- Secondary (toggle): all incomplete todos
- Quick-add input always focused, date defaults to today
- Checkbox to toggle done

#### 6d. Calendar screen (`components/CalendarView.tsx`) — major rewrite
- Week view with Google Calendar events (read-only, purple) + todos (draggable/resizable, amber)
- All-day row at top for is_all_day todos
- Current time indicator (amber line)
- Todos can be drag-resized → PATCH /v1/todos/:id
- Keep existing calendar-utils.ts for date calculations

#### 6e. Posts screen (`components/PostsView.tsx`) — new
- Chronological micro-log feed grouped by linked event/todo
- Composer with context bar (auto-derived from current time + schedule)
- `#` tag system: typing # shows autocomplete of today's events/todos
- Post cards show body + linked events/todos as chips

#### 6f. Today screen (`components/TodayView.tsx`) — new
- Three-column: sidebar (existing) + center (timeline + posts) + right (todos + AI card placeholder)
- Composes useEvents, useTodos, usePosts hooks for today's date range

#### 6g. App.tsx — major rewrite
- Remove all task/timer state management
- Simple view router: switch on currentView → render TodayView, CalendarView, PostsView, TodoView, NotesView, AccountView
- Each view manages own data via hooks (no prop drilling)
- Update keyboard shortcuts

#### 6h. Delete old components:
- TasksView, TaskSideMenu, TaskManager, TaskActivities, TaskTimeRangePicker
- TimerManager, TimerFillDialog, DurationPicker
- CommentsPanel, TagCombobox, CompletionCelebration, InProgressPanel
- CalendarFilterDropdown, PlanningPanel
- Any planning/, review/, tabs/ directories

### Phase 7: Cleanup & Polish

1. Delete old core files: tasks.*.ts, timers.*.ts, tags.*.ts, comments.*.ts, activities.*.ts
2. Delete old test files, write new tests for each core module
3. Find-and-replace "Techoo" → "Techo" across codebase
4. Update CLAUDE.md to reflect new product architecture
5. Update Electron main process (remove task-detail IPC if unused)
6. Delete old lib files: timer-aggregation.ts, date-groups.ts (if unused)

---

## Verification

After each phase:
- **Phase 1**: `pnpm --filter backend run drizzle:push:local` succeeds, manual insert/read on each new table
- **Phase 2**: Unit tests for each `.db.ts` file pass
- **Phase 3**: `pnpm --filter backend run dev:local`, hit endpoints via curl/OpenAPI doc at `/api/doc`
- **Phase 4**: `pnpm --filter electron run api:generate` succeeds, generated types compile
- **Phase 5-6**: `pnpm --filter electron run dev`, each screen renders and fetches data
- **Final**: `pnpm run check-types` passes across all packages, `pnpm run test` passes

---

## Critical File Paths

| Purpose | Path |
|---------|------|
| DB Schema | `apps/backend/src/app/db/schema/schema.ts` |
| API Factory | `apps/backend/src/app/api/[[...route]]/route.ts` |
| Routes index | `apps/backend/src/app/api/[[...route]]/routes/index.ts` |
| Handlers index | `apps/backend/src/app/api/[[...route]]/handlers/index.ts` |
| Multi-tenant | `apps/backend/src/app/core/common.db.ts` |
| Auth | `apps/backend/src/app/core/auth.ts` |
| Electron App | `apps/electron/src/renderer/src/App.tsx` |
| Sidebar | `apps/electron/src/renderer/src/components/Sidebar.tsx` |
| UI Components | `apps/electron/src/renderer/src/components/ui/` |
| API Mutator | `apps/electron/src/renderer/src/lib/api/mutator.ts` |
| Orval Config | `apps/electron/orval.config.js` |
