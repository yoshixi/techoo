# SWR Cache Consolidation Plan

## Problem

There are 6 independent SWR caches for overlapping task data:

| # | Cache | Location | Query Filters |
|---|-------|----------|---------------|
| 1 | `activeTasks` | useTasksData | `hasActiveTimer=true` + view filters |
| 2 | `inactiveTasks` | useTasksData | `hasActiveTimer=false` + view filters |
| 3 | `sidebarActiveTasks` | useTasksData | `hasActiveTimer=true` (unfiltered) |
| 4 | `reviewTasks` | useTasksData | `startAtFrom=14 days ago` |
| 5 | `todayTasks` | NowTab (local) | `hasActiveTimer=false, scheduled=true, completed=false, today range` |
| 6 | Local tasks | UpcomingTab (local) | `scheduled/completed toggles, tags` |

Every mutation must fan out optimistic updates to all caches containing the affected task. This causes:
- Business logic leaking into presentation components
- No rollback on API failure for tab-local caches
- "Uncomplete" from ReviewTab doesn't restore tasks in tab-local caches
- Race conditions on rapid toggles

## Solution: Centralize SWR Queries in useTasksData

**Principle**: Keep efficient server-side filtered queries (don't fetch everything client-side), but move ALL queries into `useTasksData` so optimistic updates are centralized in one place. Tabs become pure presentational components receiving data via props.

### What changes vs. current architecture
- NowTab's `todayTasks` query moves into `useTasksData`
- UpcomingTab's filtered query moves into `useTasksData`
- UpcomingTab's local filter state (`showCompleted`, `showUnscheduled`) lifts to `TasksView` and is passed to `useTasksData`
- All tabs receive data via props (like ReviewTab already does)
- All optimistic updates happen in `useTasksData` handlers only

### What stays the same
- Server-side filtering via API query params (no wasteful broad fetches)
- Existing SWR queries 1-4 in `useTasksData` (already centralized)
- `reviewTasks` query unchanged
- API interface unchanged

## Implementation Phases

### Phase 1: Move NowTab's todayTasks query into useTasksData

**File**: `useTasksData.ts`

1. Add `nowTodayTasks` SWR query (same params NowTab currently uses):
   ```
   { hasActiveTimer: 'false', scheduled: 'true', completed: 'false',
     startAtFrom: todayRange.startAt, startAtTo: todayRange.endAt,
     sortBy: 'startAt', order: 'asc', tags: filterTagIds }
   ```
2. Add `mutateNowTodayTasks` to `mutateBothTaskLists`.
3. Expose `nowTodayTasks: Task[]` in `UseTasksDataReturn`.
4. Add optimistic updates for `nowTodayTasks` in relevant handlers (complete, delete, start timer).

**File**: `NowTab.tsx`

1. Remove `useGetApiTasks` call and `mutateTodayTasks`.
2. Add `todayTasks: Task[]` to `NowTabProps`, receive via props.
3. Remove local `handleToggleCompletion` -- use `onToggleCompletion` directly.

**File**: `TasksView.tsx`

1. Pass `data.nowTodayTasks` to NowTab.

### Phase 2: Move UpcomingTab's query into useTasksData

**File**: `TasksView.tsx` (lift state)

1. Add `upcomingShowCompleted` and `upcomingShowUnscheduled` state.
2. Pass them down to `useTasksData` options and to UpcomingTab as props + callbacks.

**File**: `useTasksData.ts`

1. Add `upcomingShowCompleted` and `upcomingShowUnscheduled` to `TasksDataOptions`.
2. Add `upcomingTasks` SWR query (same params UpcomingTab currently uses):
   ```
   { scheduled: showUnscheduled ? undefined : 'true',
     completed: showCompleted ? undefined : 'false',
     sortBy: 'startAt', order: 'asc',
     nullsLast: showUnscheduled ? 'true' : undefined,
     tags: filterTagIds }
   ```
3. Add `mutateUpcomingTasks` to `mutateBothTaskLists`.
4. Expose `upcomingTasks: Task[]` in `UseTasksDataReturn`.
5. Add optimistic updates for `upcomingTasks` in relevant handlers.

**File**: `UpcomingTab.tsx`

1. Remove `useGetApiTasks` call and `mutateLocalTasks`.
2. Change props: receive `tasks: Task[]`, `showCompleted`, `showUnscheduled`, `onShowCompletedChange`, `onShowUnscheduledChange`.
3. Remove local `handleToggleCompletion` -- use `onToggleCompletion` directly.
4. Remove `isLoading` local state (parent provides data; optionally pass loading from hook).

### Phase 3: Simplify optimistic update handlers

**File**: `useTasksData.ts`

Now that all SWR caches are in one place, `handleToggleTaskCompletion` can update all relevant caches:
- `mutateActiveTasks` / `mutateInactiveTasks` -- filter out completed task
- `mutateNowTodayTasks` -- filter out completed task
- `mutateUpcomingTasks` -- filter out or update completedAt (depending on showCompleted)
- `mutateReviewTasks` -- update completedAt (review shows completed tasks)

Similar centralization for `handleStartTimer`, `handleStopTimer`, `handleDeleteTask`, `handleCreateTaskAndStartTimer`.

`mutateBothTaskLists()` revalidates all caches after API success, providing rollback on failure.

### Phase 4: Clean up

1. Remove unused imports from NowTab/UpcomingTab (`useGetApiTasks`).
2. Simplify `TasksDataOptions` if calendar-specific options can be separated.
3. Run `pnpm run check-types`.
4. Manual test all mutation flows from all tabs.

## Migration Strategy

Can be done in **2 PRs**:

1. **PR 1 (Phase 1, 3)**: Move NowTab query to hook, centralize its optimistic updates. Small, low-risk.
2. **PR 2 (Phase 2, 3, 4)**: Move UpcomingTab query + lift filter state. Larger but straightforward.

## Key Design Decisions

1. **Server-side filtering preserved**: Each view's query uses specific API params. No wasteful broad fetches.
2. **Filter state lifted to TasksView**: UpcomingTab's `showCompleted`/`showUnscheduled` toggles become controlled props. This is the standard React pattern -- UI state that affects data fetching should live above the data-fetching hook.
3. **All optimistic updates in one file**: `useTasksData.ts` is the single place to update when adding new mutations or views.
4. **Tabs are presentational**: They receive `tasks: Task[]` and callbacks. No SWR imports, no cache mutation logic.

## Critical Files

- `apps/electron/src/renderer/src/hooks/useTasksData.ts` -- Add 2 new SWR queries, centralize all optimistic updates
- `apps/electron/src/renderer/src/components/tabs/NowTab.tsx` -- Remove local SWR, receive todayTasks via props
- `apps/electron/src/renderer/src/components/tabs/UpcomingTab.tsx` -- Remove local SWR, receive tasks via props
- `apps/electron/src/renderer/src/components/TasksView.tsx` -- Lift UpcomingTab filter state, pass new props
