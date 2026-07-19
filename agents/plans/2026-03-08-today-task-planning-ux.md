**Date:** 2026-03-08
**Status:** Accepted
**Branch:** today-task-planning-ux

---

# Today Task Planning UX

## Problem

Every morning, users need a structured way to plan their day. Currently, NowTab offers quick capture and running timers, but there's no dedicated flow for reviewing what needs to be done today, carrying over unfinished tasks from previous days, and building a time-blocked schedule.

## Design Principles

- **No backend changes** — the existing tasks API already supports `completed`, `startAtFrom`, `startAtTo`, `scheduled`, `sortBy`, and `PUT /api/tasks/:id` for updating `startAt`/`endAt`. This is sufficient.
- **Lightweight flow** — not a heavy wizard. A single-screen planning view that feels natural.
- **Incremental** — changes save immediately via existing `PUT /api/tasks/:id`. No "confirm all" step needed.

## UX Flow

### Entry Point

- "Plan Today" button in NowTab header area (next to "Start Something")
- Shows a badge with carryover count (incomplete tasks from past days)
- Opens a planning overlay/panel (not a separate tab)

### Planning View (Single Screen)

The planning view is a single scrollable screen with three sections:

```
┌──────────────────────────────────────────────┐
│  Plan Your Day                        [Done] │
├──────────────────────────────────────────────┤
│                                              │
│  CARRY OVER (3)                              │
│  Tasks from previous days not yet completed  │
│                                              │
│  ☐ Write quarterly report (from Mar 6)       │
│      [Today] [Skip] [Done]                   │
│  ☐ Review PR #142 (from Mar 7)               │
│      [Today] [Skip] [Done]                   │
│  ☐ Update docs (from Mar 5)                  │
│      [Today] [Skip] [Done]                   │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  ADD TASKS                                   │
│  ┌─────────────────────────────┐  [Add]      │
│  │ What do you need to do?     │             │
│  └─────────────────────────────┘             │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  TODAY'S PLAN (5)                            │
│  Drag to reorder • Click time to edit        │
│                                              │
│  09:00 - 10:00  Write quarterly report       │
│  10:00 - 10:30  Review PR #142               │
│  10:30 - 12:00  Feature implementation       │
│  ──── Google Calendar: Lunch ────            │
│  13:00 - 14:00  Update docs                  │
│  14:00 -        Team standup (no time set)   │
│                                              │
│  ──── 3h 30m scheduled • 4h 30m free ────   │
│                                              │
└──────────────────────────────────────────────┘
```

### Section 1: Carry Over

- Query: `GET /api/tasks?completed=false&startAtTo={todayStart}&scheduled=true`
  - This returns incomplete tasks whose `startAt` is before today (overdue)
- Each task shows its original date for context
- Three actions per task:
  - **Today**: `PUT /api/tasks/:id { startAt: todayMorning }` — moves task to today
  - **Skip**: `PUT /api/tasks/:id { startAt: null }` — unschedules (back to backlog)
  - **Done**: existing `handleToggleTaskCompletion` — marks complete with strikethrough
- Bulk actions: "Move All to Today" / "Skip All"

### Section 2: Add Tasks

- Simple input like existing "Start Something" but creates tasks without starting timers
- Uses existing `POST /api/tasks` with `startAt` set to today
- Optional tag picker (reuse TagCombobox)
- Tasks appear in "Today's Plan" section immediately after creation

### Section 3: Today's Plan

- Shows all tasks scheduled for today: `GET /api/tasks?startAtFrom={todayStart}&startAtTo={tomorrowStart}&completed=false&sortBy=startAt&order=asc`
  - This is the same query as the existing `nowTodayTasks` SWR cache
- Google Calendar events shown as read-only gray blocks (from existing calendar events API)
- Click on a task's time → inline time picker to set/change `startAt` and `endAt`
- Drag to reorder (updates `startAt`/`endAt` via individual `PUT /api/tasks/:id` calls)
- Summary footer: total scheduled time vs free time

### Closing

- "Done" button closes the planning view and returns to NowTab
- No explicit save needed — all changes were already persisted via individual API calls
- NowTab's "Today's Schedule" section reflects the planned tasks immediately (same SWR cache)

## Data Architecture

Following the centralized SWR cache pattern for the renderer (historical; see root `CLAUDE.md` for the current architecture):

### New SWR Cache: Carryover Tasks

```typescript
// In useTasksData — only fetched when planning view is open
const { data: carryoverResponse, mutate: mutateCarryover } = useGetApiTasks(
  isPlanningOpen ? {
    completed: 'false',
    startAtTo: todayStart,    // startAt < today
    scheduled: 'true',        // only tasks that were scheduled
    sortBy: 'startAt',
    order: 'asc',
  } : null  // Skip when planning is closed
)
```

- Add `mutateCarryover` to `mutateBothTaskLists()` for revalidation
- Add `isPlanningOpen` to `TasksDataOptions`

### Existing Caches Reused

- **nowTodayTasks** — already queries today's scheduled tasks. The planning view's "Today's Plan" section uses this same data.
- **Calendar events** — existing calendar event fetching for the CalendarView can be reused.

### Handlers

All mutations use existing handlers — no new ones needed:

- **Move to Today**: `PUT /api/tasks/:id { startAt: todayMorning }` — use existing `putApiTasksId` + optimistic update in carryover + nowTodayTasks caches
- **Skip**: `PUT /api/tasks/:id { startAt: null }` — same pattern, removes from carryover
- **Done**: existing `handleToggleTaskCompletion`
- **Add task**: existing `POST /api/tasks` with `startAt` set to today
- **Edit time slot**: `PUT /api/tasks/:id { startAt, endAt }` — optimistic update in nowTodayTasks

### New Handler: handleUpdateTaskSchedule

One new convenience handler composing existing API:

```typescript
const handleUpdateTaskSchedule = useCallback(async (
  taskId: number,
  startAt: string | null,
  endAt?: string | null
) => {
  // Optimistic update in all relevant caches (carryover, nowTodayTasks, upcomingTasks)
  const optimisticUpdate = (currentData) => ({
    ...currentData,
    tasks: currentData.tasks.map(t =>
      t.id === taskId ? { ...t, startAt, endAt: endAt ?? t.endAt } : t
    )
  })
  mutateCarryover(optimisticUpdate, { revalidate: false })
  mutateNowTodayTasks(optimisticUpdate, { revalidate: false })
  mutateUpcomingTasks(optimisticUpdate, { revalidate: false })

  await putApiTasksId(taskId, { startAt, endAt })
  mutateBothTaskLists()
}, [...])
```

## Component Design

```
components/
  planning/
    PlanningPanel.tsx          # Main overlay/panel container
    CarryoverSection.tsx       # Carryover task list with actions
    AddTaskSection.tsx         # Quick-add input for new today tasks
    TodayPlanSection.tsx       # Today's scheduled tasks with time editing
    PlanningTrigger.tsx        # "Plan Today" button with badge
    TimeSlotEditor.tsx         # Inline time picker for a task
```

### PlanningPanel

- Overlay panel (slide-in from right, or full-width overlay with backdrop)
- Contains the three sections stacked vertically
- "Done" button in header to close
- Receives all data and handlers via props (presentational, per architecture doc)

### CarryoverSection

- List of overdue tasks with action buttons
- "Move All to Today" and "Skip All" bulk action buttons at top
- Tasks animate out when acted upon (similar to completion strikethrough)
- Empty state: "All caught up! No tasks from previous days."

### TodayPlanSection

- Ordered list of today's tasks
- Each row: time display (clickable → TimeSlotEditor) + title + tags
- Google Calendar events interspersed as non-interactive gray rows
- Footer with time summary

### TimeSlotEditor

- Inline popover with start time + end time pickers
- Quick duration buttons: 30m, 1h, 2h
- "Clear" to unset the time slot
- Calls `handleUpdateTaskSchedule` on save

### PlanningTrigger

- Button in NowTab: "Plan Today" with carryover count badge
- Badge only shows when there are carryover tasks
- Could also auto-show on first app open of the day (stored in localStorage: `techoo:lastPlanDate`)

## Props Flow

```
App.tsx
  state: isPlanningOpen, setIsPlanningOpen
    → passed to useTasksData (controls carryover query)
    → passed to TasksView/NowTab (shows PlanningTrigger)

PlanningPanel (rendered in App.tsx when isPlanningOpen)
  props:
    carryoverTasks: Task[]
    todayTasks: Task[]           # from nowTodayTasks
    calendarEvents: CalendarEvent[]
    onUpdateSchedule: (taskId, startAt, endAt) => void
    onToggleCompletion: (task) => void
    onCreateTask: (title, tagIds) => void
    onClose: () => void
```

## Implementation Phases

### Phase 1: Carryover Review (MVP) ✅
- Add `isPlanningOpen` state to App.tsx
- Add carryover SWR cache to useTasksData (conditional on isPlanningOpen)
- PlanningTrigger button in NowTab with carryover count badge
- PlanningPanel with CarryoverSection only
- Today/Skip/Done actions per task
- Bulk "Move All to Today" action

### Phase 2: Add Tasks + Today's Plan ✅
- AddTaskSection with quick-add input (creates task with startAt=today)
- TodayPlanSection showing today's scheduled tasks (reuses nowTodayTasks data)
- DurationPicker for setting task duration
- `handleUpdateTaskSchedule` handler in useTasksData
- Time summary footer

### Phase 3: Calendar Context + Auto-Show ✅
- Show Google Calendar events in Today's Plan as read-only context blocks (dashed border, muted style)
- Tasks and events merged into a single timeline sorted by start time
- Auto-show planning modal on first app open of the day (localStorage `techoo:lastPlanDate`)
- Calendar events fetched when planning panel is open (reuses existing `useCalendarEvents` hook)

### Phase 4: Calendar Event Conversion + Timer Fill-out ✅
- One-click convert calendar event to task: hover on calendar event shows + button, creates task with same title/time
- Timer fill-out dialog when completing task without timer records: pre-fills startAt/endAt, user can confirm or skip
- Delete task button on planning calendar timeline
