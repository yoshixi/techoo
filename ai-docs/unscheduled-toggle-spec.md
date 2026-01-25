# Unscheduled Tasks Toggle Specification

## Overview

The task table view includes an "Unscheduled" toggle that controls the visibility and ordering of tasks without a scheduled start time (`startAt` is null).

## Toggle Behavior

| Toggle State | Behavior |
|--------------|----------|
| **ON** (default) | Shows all tasks. Scheduled tasks appear first (sorted by `startAt` ascending), unscheduled tasks appear last |
| **OFF** | Only shows scheduled tasks (hides unscheduled tasks) |

## Interaction with Other Filters

### Today Filter + Unscheduled Toggle

| Today | Unscheduled | Result |
|-------|-------------|--------|
| ON | ON | Today's scheduled tasks + all unscheduled tasks (scheduled first) |
| ON | OFF | Only today's scheduled tasks |
| OFF | ON | All tasks (scheduled first, then unscheduled) |
| OFF | OFF | Only scheduled tasks |

### Sort Order

When the "Unscheduled" toggle is ON and sorting by "Start Date":
1. **Scheduled tasks** appear first, sorted by `startAt` ascending (earliest first)
2. **Unscheduled tasks** appear after all scheduled tasks

## Implementation Details

### Backend (API)

The `nullsLast` query parameter controls the sort order:
- When `nullsLast=true`: Uses SQL `ORDER BY (field IS NULL), field ASC` to put NULL values last
- This is a standard SQLite pattern where `field IS NULL` returns 0 for non-null and 1 for null values

**Files:**
- `apps/web/app/core/tasks.core.ts` - Defines `nullsLast` in `TaskQueryParamsModel`
- `apps/web/app/core/tasks.db.ts` - Implements the NULLS LAST sorting logic
- `apps/web/app/api/[[...route]]/handlers/tasks.ts` - Passes parameter to database layer

### Frontend (Electron App)

The `showUnscheduled` state controls:
1. **Filtering**: When OFF, sets `scheduled='true'` to hide unscheduled tasks
2. **Ordering**: When ON, sets `nullsLast='true'` to put unscheduled tasks last

**Files:**
- `apps/electron/src/renderer/src/App.tsx` - Contains toggle state and query construction

### Query Parameters Mapping

| showUnscheduled | showTodayOnly | scheduled param | nullsLast param |
|-----------------|---------------|-----------------|-----------------|
| true | true | 'false' (OR logic with date range) | 'true' |
| true | false | undefined (no filter) | 'true' |
| false | true | 'true' (only scheduled) | undefined |
| false | false | 'true' (only scheduled) | undefined |

## User Experience

- Default state: Both "Today" and "Unscheduled" toggles are ON
- Users see today's scheduled tasks first, followed by all unscheduled tasks
- Turning OFF "Unscheduled" hides tasks without a start time, showing only scheduled work
- The ordering is automatic - no separate "sort" option needed for scheduled-first behavior
