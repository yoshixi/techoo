# Dev Log: hasActiveTimer API Filter Implementation

**Date:** 2026-01-12

## Summary

Added `hasActiveTimer` query parameter to the tasks API to filter tasks by whether they have an active timer running. This enables the frontend to make separate API calls for active and inactive tasks, preventing visual flickering during revalidation.

## Changes Made

### Backend

1. **`apps/web/app/core/tasks.core.ts`**
   - Added `hasActiveTimer` to `TaskQueryParamsModel` using the existing `BooleanQueryParam` pattern

2. **`apps/web/app/core/tasks.db.ts`**
   - Added `exists`, `notExists`, and `sql` imports from drizzle-orm
   - Implemented filtering using EXISTS/NOT EXISTS subqueries

3. **`apps/web/app/api/[[...route]]/handlers/tasks.ts`**
   - Updated handler to extract and pass `hasActiveTimer` parameter

### Frontend

1. **`apps/electron/src/renderer/src/App.tsx`**
   - Refactored to use two separate API queries:
     - `hasActiveTimer: 'true'` for "In Progress" section
     - `hasActiveTimer: 'false'` for "Tasks" section
   - Added optimistic UI updates for timer start/stop (moves tasks between lists)
   - Updated all task mutations to use appropriate mutators

## Bug Fix: Blob Comparison Issue

### Problem
Initial implementation used `inArray`/`notInArray` with task IDs fetched from a separate query:

```typescript
const activeTimerTasks = await db
  .selectDistinct({ taskId: taskTimersTable.taskId })
  .from(taskTimersTable)
  .where(isNull(taskTimersTable.endTime))

activeTimerTaskIds = activeTimerTasks.map(row => row.taskId)
// Then used: inArray(tasksTable.id, activeTimerTaskIds)
```

This didn't work because SQLite blob values from different queries weren't being compared correctly by Drizzle ORM.

### Solution
Used EXISTS/NOT EXISTS subqueries instead, letting SQLite handle the blob comparison internally:

```typescript
const activeTimerSubquery = db
  .select({ one: sql`1` })
  .from(taskTimersTable)
  .where(
    and(
      eq(taskTimersTable.taskId, tasksTable.id),  // Direct comparison in SQL
      isNull(taskTimersTable.endTime)
    )
  )

if (filters.hasActiveTimer === true) {
  baseConditions.push(exists(activeTimerSubquery))
} else {
  baseConditions.push(notExists(activeTimerSubquery))
}
```

### Key Insight
When using Drizzle ORM with SQLite blob types (used for UUID storage), avoid fetching IDs and comparing them in JavaScript. Instead, use SQL subqueries (EXISTS, IN with subquery, JOINs) to let the database handle the comparison.

## API Usage

```
GET /api/tasks?hasActiveTimer=true   # Tasks with running timers
GET /api/tasks?hasActiveTimer=false  # Tasks without running timers
GET /api/tasks                       # All tasks (no filter)
```

## Testing

```bash
# Tasks with active timers
curl "http://localhost:3000/api/tasks?hasActiveTimer=true"

# Tasks without active timers
curl "http://localhost:3000/api/tasks?hasActiveTimer=false"
```

## Files Modified

- `apps/web/app/core/tasks.core.ts`
- `apps/web/app/core/tasks.db.ts`
- `apps/web/app/api/[[...route]]/handlers/tasks.ts`
- `apps/electron/src/renderer/src/App.tsx`
- `apps/electron/src/renderer/src/components/Sidebar.tsx` (removed unused import)
