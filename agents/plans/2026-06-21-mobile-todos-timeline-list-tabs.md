**Date:** 2026-06-21
**Status:** Accepted
**Branch:** mobile-todos-timeline-list-tabs

---

# Mobile: ToDos — Timeline + List tabs (revised UX)

## Direction change

Replace separate navigation rows / pages (`/todo/later`, `/todo/completed`) with **two sub-tabs on the ToDos screen**:

| Tab | Role |
|-----|------|
| **Timeline** | Current hour-grid plan view (default) |
| **List** | Table-style flat list with **filters** — covers open, Later, completed, all-day in one surface |

Week strip + selected day stay **shared** above both tabs.

Supersedes the separate-page approach in [`mobile-later-todos-page.md`](./mobile-later-todos-page.md) for v1.

---

## Layout

```text
┌─────────────────────────────────────┐
│  ToDos          ◀  Wed 18  Thu 19 ▶ │  WeeklyTabHeader (shared)
├─────────────────────────────────────┤
│  ┌──────────────┬──────────────┐    │
│  │  Timeline ▲  │     List     │    │  segmented control
│  └──────────────┴──────────────┘    │
├─────────────────────────────────────┤
│  (tab content)                      │
└─────────────────────────────────────┘
│  FAB +                              │
```

- Persist last tab in `AsyncStorage` (optional, nice-to-have)
- Timeline tab: scroll-to-now, current-time line (existing behavior)
- List tab: `FlatList`, pull-to-refresh, sticky filter bar

---

## Timeline tab

Same as today except:

- **Remove** bottom “Later” block — Later items appear in List tab (filter preset)
- Optional subtle hint when Later count > 0: `3 in Later · List tab` (one line, not a button) — **defer** unless users miss it

Data: unchanged — `useTodos({ from, to, includeCompletedInRange: false })`, day-scoped open items for grid.

---

## List tab

### Default filters (when opening tab)

| Filter | Default |
|--------|---------|
| **Status** | Open |
| **Schedule** | All |
| **Scope** | Selected day (follows week strip) |

Matches “what’s on this day” including Later (unscheduled) when viewing today.

### Filter chips (horizontal scroll)

**Row 1 — Status**

```text
[ Open ]  [ Done ]  [ All ]
```

**Row 2 — Schedule**

```text
[ All ]  [ Timed ]  [ Later ]  [ All day ]
```

- **Later** = `starts_at == null`, not all-day
- **Timed** = has `starts_at`, not all-day
- **All day** = `is_all_day === 1`

**Row 3 — Scope** *(optional v1.1; can ship day-only first)*

```text
[ This day ]  [ All open ]  [ Recent 14d ]
```

- **This day** — items relevant to `selectedDay` (same rules as timeline scoping + completed by `done_at` when Status = Done)
- **All open** — global open queue (replaces hidden `/todos` for most users)
- **Recent 14d** — for Done / All status

### List row (table-style)

```text
┌────┬──────────────────────────────┐
│ ○  │ Team sync                    │
│    │ 2:00 – 3:00 PM · Timed       │
├────┼──────────────────────────────┤
│ ○  │ Buy milk                     │
│    │ No time · Later              │
├────┼──────────────────────────────┤
│ ✓  │ Email reply                  │
│    │ Done 3:42 PM                 │
└────┴──────────────────────────────┘
```

- Checkbox → `toggleDone`
- Tap row → `/todo/[id]`
- Done rows: strikethrough + muted
- Sort (fixed per status):
  - Open: `starts_at ?? created_at` asc (unscheduled last or first — **unscheduled last** within day)
  - Done: `done_at` desc

### Empty states

Contextual copy from active filters, e.g. “No open to-dos on Wed, Jun 18” / “Nothing in Later” / “Nothing completed this day”.

---

## Data layer

### Timeline tab

No change.

### List tab

Single hook `useTodosListView({ selectedDay, status, schedule, scope })`:

| status | schedule | scope | Fetch |
|--------|----------|-------|-------|
| Open | * | This day | `{ from, to, done: false }` + client schedule filter + day scope |
| Open | Later | All open | `{ showAll: true }` + filter unscheduled |
| Done | * | This day | `{ from, to, includeDone: true }` + filter `done===1` + `done_at` on day |
| Done | * | Recent | `{ from: -14d, to: now, includeDone: true }` + filter |
| All | * | … | combine filters |

**Requires:** extend `useTodos` with `includeDone` (omit `done: 'false'` on range queries).

Client-side filter is fine for v1; no new API routes.

---

## Components

| File | Role |
|------|------|
| `app/(tabs)/index.tsx` | Shell: header, segment, tab switch |
| `components/todos/TodosTimelineView.tsx` | Extract current timeline body |
| `components/todos/TodosListView.tsx` | Filters + FlatList |
| `components/todos/TodoFilterChips.tsx` | Status / schedule / scope pills |
| `components/todos/TodoListRow.tsx` | Shared row |
| `hooks/useTodosListFilters.ts` | Filter state + derived query + filtered list |

---

## Preset shortcuts (optional)

Quick filter combos via chip long-press or preset row:

```text
Later (3)   ·   Done today (2)
```

Tapping sets filters — not separate routes. **Nice-to-have after basic chips work.**

---

## Non-goals (v1)

- Sort picker / column headers (fixed sort per status)
- Title search (desktop has it; defer)
- Separate `/todo/later` and `/todo/completed` stack screens
- Third sub-tab

---

## Test plan

- [ ] Switch tabs preserves `selectedDay`
- [ ] Timeline unchanged (scroll-to-now, timed grid)
- [ ] List + Open + This day ≈ timeline items (+ Later when today)
- [ ] List + Later + All open shows global unscheduled queue
- [ ] List + Done + This day shows completions for selected day
- [ ] Toggle done in List updates Timeline after switch
- [ ] Filters persist while on List tab; reset Scope when changing week day (or keep — **recommend reset scope to This day**)

---

## Open decisions

1. Tab labels: **Timeline | List** — **done**
2. Scope row in v1: **This day, All open, Recent 14d** — **done**
3. Filter persistence: **AsyncStorage** — **done**
4. Presets **Later (N)** / **Done today (N)** — **done**
5. Week navigation: **prev/next chevrons on week strip** — **done**
6. Post-create navigation — **done**
   - Later → List tab + Later filters
   - Timed / All day → Timeline on task date, scroll to start time (timed only)
7. Timed create: **date picker added** so tasks can target any week

## Implementation status

Implemented in mobile app (`app/(tabs)/index.tsx` and related components/hooks).
