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

### Why the Broken Pattern Fails

SQLite stores UUIDs as blobs. When Drizzle fetches these blob values and you pass them back into another query, the comparison doesn't work correctly - the blob representations don't match even though they represent the same UUID.

```typescript
// BROKEN: Fetching IDs in one query, then using them in another
const activeTimerTasks = await db
  .selectDistinct({ taskId: taskTimersTable.taskId })
  .from(taskTimersTable)
  .where(isNull(taskTimersTable.endTime))

// These IDs are blob values
const activeTimerTaskIds = activeTimerTasks.map(row => row.taskId)

// This comparison fails - blob values don't match correctly
const tasks = await db
  .select()
  .from(tasksTable)
  .where(inArray(tasksTable.id, activeTimerTaskIds))  // Returns nothing!
```

### About `sql`1`` in EXISTS Subqueries

The `` sql`1` `` is just a placeholder value - it returns the constant `1` for each matching row.

In an `EXISTS` subquery, **the actual returned value doesn't matter**. EXISTS only checks whether the subquery returns **any rows at all**, not what those rows contain.

```typescript
// These are all equivalent for EXISTS:
db.select({ one: sql`1` }).from(...)      // Returns 1
db.select({ x: sql`'hello'` }).from(...)  // Returns 'hello'
db.select({ id: taskTimersTable.id }).from(...)  // Returns actual ID
```

The generated SQL looks like:

```sql
SELECT * FROM tasks
WHERE EXISTS (
  SELECT 1 FROM task_timers
  WHERE task_timers.task_id = tasks.id
  AND task_timers.end_time IS NULL
)
```

Using `SELECT 1` is a common convention because:
1. It's clear that we don't care about the returned value
2. It's slightly more efficient - no need to fetch actual column data
3. It signals intent: "I just want to check if rows exist"

## Additional Fix: Tag Filtering

The same blob comparison issue affected the existing tag filtering functionality. Tag filtering was using:

```typescript
// Old approach (broken)
const taskIdsWithTags = await db
  .selectDistinct({ taskId: taskTagsTable.taskId })
  .from(taskTagsTable)
  .where(inArray(taskTagsTable.tagId, tagIds))

const tagTaskIds = taskIdsWithTags.map(row => row.taskId)
baseConditions.push(inArray(tasksTable.id, tagTaskIds))
```

Fixed with EXISTS subquery:

```typescript
// New approach (working)
const tagFilterSubquery = db
  .select({ one: sql`1` })
  .from(taskTagsTable)
  .where(
    and(
      eq(taskTagsTable.taskId, tasksTable.id),
      inArray(taskTagsTable.tagId, tagIds)
    )
  )
baseConditions.push(exists(tagFilterSubquery))
```

## Test Fixes

Fixed type errors in `apps/web/app/core/timers.db.test.ts` by adding proper null checks before accessing array elements (TypeScript strict null checks).

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
