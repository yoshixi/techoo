# React Data Architecture

This document describes the data fetching and state management architecture for the Electron renderer app.

## Core Principle: Centralized SWR Caches with Presentational Tabs

All SWR queries live in a single hook (`useTasksData`). Tab components are purely presentational -- they receive data via props and call callbacks. They never own SWR caches or manage optimistic updates.

This ensures:
- Optimistic updates happen in **one place** for all views
- Server revalidation reaches all caches consistently
- Error rollback works everywhere (revalidate all caches on failure)
- No business logic leaks into presentation components

## Architecture Overview

```
App.tsx
  └─ useTasksData(options)          # Single hook owns ALL SWR caches
       ├─ activeTasks               # Tasks with active timers (filtered)
       ├─ inactiveTasks             # Tasks without active timers (filtered)
       ├─ sidebarActiveTasks        # Active timer tasks (unfiltered, for sidebar)
       ├─ nowTodayTasks             # Today's scheduled tasks (NowTab)
       ├─ upcomingTasks             # All tasks with user filters (UpcomingTab)
       ├─ reviewTasks               # Last 14 days including completed (ReviewTab)
       ├─ timers                    # Timer data
       └─ mutation handlers         # handleStartTimer, handleToggleTaskCompletion, etc.
  └─ TasksView
       ├─ NowTab(props)            # Pure presentational
       ├─ UpcomingTab(props)        # Pure presentational
       └─ ReviewTab(props)          # Pure presentational
```

## Cache-Per-View Pattern

Each view has its own SWR cache with server-side filtered queries. This keeps API calls efficient -- we don't fetch everything and filter client-side.

```
View                SWR Query Filters
─────────────────   ──────────────────────────────────────────
activeTasks         hasActiveTimer=true, completed=false, ...
inactiveTasks       hasActiveTimer=false, completed=false, ...
sidebarActiveTasks  hasActiveTimer=true (no other filters)
nowTodayTasks       hasActiveTimer=false, scheduled=true, completed=false, today range
upcomingTasks       scheduled/completed toggles, tag filters
reviewTasks         startAtFrom=14 days ago (includes completed)
```

## Optimistic Updates

All optimistic updates are centralized in `useTasksData` mutation handlers. When a mutation occurs:

1. **Optimistically update** all relevant SWR caches (set new state without revalidation)
2. **Call the API**
3. **Revalidate all caches** from the server via `mutateBothTaskLists()` on success or failure

### Completion Toggle Strategy

When completing a task, we **update `completedAt` in all caches** instead of filtering the task out. This allows the UI to show a visual transition (opacity + strikethrough) before the task disappears on server revalidation.

```
User clicks complete
  → optimistic: set completedAt on task in all caches
  → UI shows strikethrough animation immediately
  → API call: PUT /api/tasks/:id { completedAt }
  → server revalidation: queries with completed=false no longer include the task
  → task disappears from filtered views naturally
```

This approach avoids the problem where removing a task optimistically gets immediately reverted by server revalidation (since the revalidation brings back fresh data that may still include the task during the brief API roundtrip).

### Delete Strategy

For deletes, we **filter the task out** of all caches immediately since there's no visual transition needed and the task won't exist after the API call.

## Lifted Filter State

Tab-specific filter state (e.g., UpcomingTab's `showCompleted` / `showUnscheduled` toggles) is lifted to the parent (`App.tsx`) and passed as options to `useTasksData`. This is necessary because filter state affects SWR query parameters, and the queries live in the hook, not in the tab.

```
App.tsx
  state: upcomingShowCompleted, upcomingShowUnscheduled
    → passed to useTasksData (affects upcomingTasks query)
    → passed to UpcomingTab (renders toggle UI)
    → UpcomingTab calls onShowCompletedChange callback → App updates state → query changes
```

## Adding a New View

To add a new tab/view that displays tasks:

1. **Add a new SWR query** in `useTasksData` with appropriate server-side filters
2. **Add its `mutate` function** to `mutateBothTaskLists()` so it revalidates with everything else
3. **Add optimistic updates** for the new cache in relevant mutation handlers
4. **Include its task IDs** in the timer query's `taskIds` if the view needs timer data
5. **Create a presentational component** that receives data via props -- no `useGetApiTasks` calls
6. If the view has filter toggles, **lift that state** to the parent and pass it to `useTasksData`

## Anti-Patterns to Avoid

- **Tab-local SWR caches**: Never call `useGetApiTasks` inside a tab component. The hook can't optimistically update caches it doesn't own.
- **Local optimistic wrappers**: Never wrap `onToggleCompletion` in a tab to do local cache mutation before delegating. All cache mutations belong in `useTasksData`.
- **Filtering out on optimistic update when server will refetch**: If `mutateBothTaskLists` will revalidate and the query includes the item, filtering it out optimistically just causes a flicker (disappear then reappear). Use `map` to update fields instead.
