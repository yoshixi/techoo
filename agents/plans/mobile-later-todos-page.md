# Mobile: Later & Completed to-dos pages

## Problem

On the **ToDos** tab (`app/(tabs)/index.tsx`):

1. **Later** (no `starts_at`) — only shown at the bottom when viewing **today**, easy to miss.
2. **Completed** — hidden entirely. Day timeline uses `includeCompletedInRange: false`, so done items vanish with no way to review what you finished.

There is a hidden **`/todos`** screen (Library only) for all **open** items. No mobile surface for Later or Completed as first-class lists.

## Product fit

From [`docs/CONCEPT.md`](../../docs/CONCEPT.md): the **day** is the unit of attention. Lists should reinforce today and the near horizon.

| Queue | Meaning |
|-------|---------|
| **Later** | Captured intent, no time yet — triage into the calendar |
| **Completed** | What you finished — read back the day’s progress, undo mistakes |

Completed is not a backlog; it is a **day log companion** (like posts, but for planned items you checked off).

---

## Goals (v1)

1. **Later page** — open, unscheduled, non-all-day to-dos
2. **Completed page** — done to-dos, **day-first** with optional wider range
3. **Entry rows** on ToDos tab — no third tab
4. Reuse SWR + `revalidateAllTodoLists()`

## Non-goals (v1)

- Drag-to-schedule, carryover, search/filters (desktop TodoView parity)
- Replacing hidden `/todos` (all open items)
- Backend changes (client filter + existing query params)

---

## Information architecture

```text
ToDos tab (day timeline)
├── Later · N items        ›  →  /todo/later
└── Completed · N          ›  →  /todo/completed?date=…

/todo/later       — global open queue (no start time)
/todo/completed   — done items (default: selected calendar day)
/todo/new         — existing
/todo/[id]        — existing
```

**Why two pages, not one?** Later = forward planning; Completed = backward review. Different sort keys, empty states, and actions.

---

## Later page (`/todo/later`)

*(unchanged from original plan — see sections below)*

| Element | Behavior |
|--------|----------|
| Title | Later |
| Subtitle | No start time — add to your day when you’re ready |
| List | Open items where `starts_at == null`, `is_all_day !== 1`, `done === 0` |
| Sort | `created_at` ascending (oldest first) |
| Row | Checkbox · title · “Added …” |
| Create | Add → `/todo/new` (Later mode default) |

**Data:** `useTodos({ showAll: true })` + client filter.

---

## Completed page (`/todo/completed`)

### Scope (segmented control at top)

| Segment | Query | Use case |
|---------|-------|----------|
| **This day** *(default)* | `from`/`to` = selected day, omit `done: 'false'`, filter `done === 1` | “What did I finish on Wed?” |
| **Recent** | Last 14 local days, same filter | Week-ish review without unbounded list |
| **All** | No date range, omit `done: 'false'`, filter `done === 1`, limit 500 | Power view; show note if truncated |

**Open from ToDos** passes `date` param (ISO day) → lands on **This day** for that week-strip selection.

### List behavior

- **Sort:** `done_at` descending (newest completions first); fallback `created_at` if `done_at` null
- **Group headers** (Recent / All): “Today”, “Yesterday”, “Mon Jun 16”, … by `done_at` local day
- **Row:** Checked circle · ~~title~~ · secondary line:
  - `Completed 3:42 PM` (from `done_at`)
  - If had schedule: `Was 2:00 – 2:30 PM` or `Was all day`
  - If was Later: `Was unscheduled`
- **Tap row** → `/todo/[id]` (mark incomplete from detail)
- **Tap checkbox** → `toggleDone` (reopen)
- Pull-to-refresh, empty state per segment

### Empty states

| Segment | Copy |
|---------|------|
| This day | Nothing completed on this day yet. |
| Recent | No completions in the last two weeks. |
| All | No completed to-dos yet. |

---

## ToDos tab entry rows

Replace inline Later block at timeline bottom with two summary rows below the stats line:

```text
Later · 3 items              ›
Completed · 2 on this day  ›   ← count scoped to selectedDay
```

- **Later count:** global (not day-scoped)
- **Completed count:** items with `done === 1` whose **`done_at`** falls on `selectedDay` (fallback: `starts_at` day if `done_at` missing — document edge case)

When completed count is 0, still show row (subtle): `Completed · none on this day ›` — optional; **recommend hide when 0** to reduce noise.

---

## Data layer

### Extend `useTodos`

Add options:

```ts
useTodos({
  showAll?: boolean       // open only, no date (existing)
  from?: Date
  to?: Date
  includeCompletedInRange?: boolean  // existing — when true, omits done:false on range queries
  // NEW: when true, never pass done:'false' (for Completed fetches)
  includeDone?: boolean
})
```

| Screen | Hook call |
|--------|-----------|
| Day timeline (open) | `{ from, to, includeCompletedInRange: false }` *(unchanged)* |
| Later | `{ showAll: true }` + filter open unscheduled |
| Completed (day) | `{ from: dayStart, to: dayEnd, includeDone: true }` + filter `done === 1` |
| Completed (recent) | `{ from: fourteenDaysAgo, to: tomorrow, includeDone: true }` + filter |
| Completed (all) | `{ includeDone: true, limit: 500 }` or `fetchAll` variant + filter |

**Note:** Range queries include unscheduled open items by default (backend). For Completed, unscheduled completed items appear when `done_at` is in range — correct.

### Shared hooks *(recommended)*

```ts
useLaterTodos()     // fetch + filter + sort for Later
useCompletedTodos({ scope: 'day' | 'recent' | 'all', anchorDate?: Date })
```

---

## Navigation

Register in `app/_layout.tsx`:

```tsx
<Stack.Screen name="todo/later" options={{ headerShown: false }} />
<Stack.Screen name="todo/completed" options={{ headerShown: false }} />
```

Presentation: **card push** (page feel, not modal).

---

## Components

| File | Role |
|------|------|
| `app/todo/later.tsx` | Later list screen |
| `app/todo/completed.tsx` | Completed list + segment control |
| `components/todos/TodoSummaryRow.tsx` | Reusable `label · count ›` row |
| `components/todos/TodoListRow.tsx` | Shared open-item row |
| `components/todos/CompletedTodoRow.tsx` | Strikethrough + done_at subtitle |
| `hooks/useLaterTodos.ts` | Later data |
| `hooks/useCompletedTodos.ts` | Completed data + grouping |

---

## Implementation steps

1. Extend `useTodos` with `includeDone`
2. Add `useLaterTodos` + `useCompletedTodos`
3. Build `/todo/later` and `/todo/completed`
4. Register stack routes
5. Add `TodoSummaryRow` ×2 on ToDos tab; remove bottom Later block
6. Wire completed count to `selectedDay`
7. Update `apps/mobile/README.md`
8. Manual test plan (below)

---

## Test plan

### Later
- [ ] Lists only open unscheduled non-all-day items
- [ ] Create (Later mode) → appears after back
- [ ] Schedule in detail → leaves Later, shows on timeline
- [ ] Summary visible on non-today week-strip days

### Completed
- [ ] **This day** shows only items completed on selected day
- [ ] Changing week strip + opening Completed uses that day
- [ ] **Recent** groups by `done_at` day
- [ ] Reopen from Completed → disappears from list, reappears on timeline/Later
- [ ] Complete item on timeline → count on Completed row updates
- [ ] Empty states per segment

---

## Open decisions

1. **Completed row when count = 0:** hide vs show “none on this day” — **recommend hide**
2. **Recent window:** 14 vs 7 days — **recommend 14** (matches logbook)
3. **All segment:** include in v1 or defer — **recommend include** with 500 cap + subtle footer
4. **Library rows** for Later / Completed — defer

---

## Future (v2+)

- Search completed by title
- Swipe “Schedule” on Later
- Export / stats (“5 completed this week”)
- Unify `/todos` with segmented Open | Later | Done
