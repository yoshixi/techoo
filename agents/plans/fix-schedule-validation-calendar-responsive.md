# Fix Plan: Schedule Validation, Calendar Popup, and Responsive Table

## Overview
Fix three related issues in the task management UI:
1. Schedule validation - prevent startAt > endAt
2. Popup calendar doesn't work when endAt is nil
3. Task table view isn't responsive

---

## Issue 1: Schedule Validation (startAt > endAt)

### Problem
Currently, users can set `startAt` after `endAt` with no validation. This creates invalid schedule data.

### Solution
Add Zod cross-field validation using `.refine()` to both `CreateTaskModel` and `UpdateTaskModel`.

### Files to Modify
- `apps/web/app/core/tasks.core.ts`

### Implementation
Add `.refine()` after the object definition for both models:

```typescript
export const CreateTaskModel = z.object({
  // ... existing fields
}).refine(
  (data) => {
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) <= new Date(data.endAt)
    }
    return true
  },
  { message: 'Start time must be before or equal to end time', path: ['endAt'] }
).openapi('CreateTask')
```

Same pattern for `UpdateTaskModel` (handle nullable case).

---

## Issue 2: Popup Calendar Doesn't Work When endAt is Nil

### Problem
In `TaskTimeRangePicker.tsx`, the `getSelectionFromRange` function returns `null` when `endAt` is missing (line 73), causing no selection to render in the calendar popup.

### Root Cause
```typescript
if (!startAt || !endAt || !dayStart || !slotMinutes || !slotCount) return null
```

### Solution
When `endAt` is nil but `startAt` exists, compute a default endAt using the existing `computeTaskEnd` function from `calendar-utils.ts` (30 minutes after startAt).

### Files to Modify
- `apps/electron/src/renderer/src/components/TaskTimeRangePicker.tsx`

### Implementation
Import `computeTaskEnd` and modify `getSelectionFromRange` to compute endAt when missing:

```typescript
import { computeTaskEnd, ... } from '../lib/calendar-utils'

const getSelectionFromRange = (
  startAt?: string | null,
  endAt?: string | null,
  dayStart?: Date,
  slotMinutes?: number,
  slotCount?: number
): DragSelection | null => {
  if (!startAt || !dayStart || !slotMinutes || !slotCount) return null

  const startDate = new Date(startAt)
  if (Number.isNaN(startDate.getTime())) return null

  // Compute default endAt if missing
  const endDate = computeTaskEnd(startDate, endAt)

  // ... rest of the function using endDate instead of parsing endAt
}
```

---

## Issue 3: Task Table View Isn't Responsive

### Problem
When window width is small, the table container doesn't follow the reduced width properly. The `p-8` padding is too large on small screens.

### Files to Modify
- `apps/electron/src/renderer/src/App.tsx`

### Implementation
Make padding responsive and ensure table wrapper handles overflow:

1. **Line 1253**: Change outer container padding
   ```typescript
   // From:
   <div className="flex flex-1 min-h-0 flex-col p-8">

   // To:
   <div className="flex flex-1 min-h-0 flex-col p-4 sm:p-6 lg:p-8">
   ```

2. **Line 1325**: Add horizontal overflow to CardContent
   ```typescript
   // From:
   <CardContent className="flex-1 min-h-0 overflow-y-auto">

   // To:
   <CardContent className="flex-1 min-h-0 overflow-auto">
   ```

3. **Line 1326**: Add overflow wrapper around Table
   ```typescript
   <div className="overflow-x-auto min-w-0">
     <Table>
       ...
     </Table>
   </div>
   ```

---

## Verification

### Testing Schedule Validation
1. Run `pnpm run dev` in both web and electron apps
2. Open a task detail
3. Try to set startAt = "2024-01-15 10:00" and endAt = "2024-01-15 09:00"
4. Verify the API returns a validation error

### Testing Calendar Popup with Nil endAt
1. Create a task with only startAt set (no endAt)
2. Open task detail and click the calendar icon
3. Verify a selection block appears at the startAt time (with 30-min default duration)
4. Verify you can drag/resize the selection

### Testing Responsive Table
1. Resize the Electron window to a narrow width (< 640px)
2. Verify the table is horizontally scrollable
3. Verify padding shrinks appropriately
4. Verify content remains readable and usable

### Type Checking
```sh
pnpm run check-types
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `apps/web/app/core/tasks.core.ts` | Add refine validation to CreateTaskModel and UpdateTaskModel |
| `apps/electron/src/renderer/src/components/TaskTimeRangePicker.tsx` | Use computeTaskEnd when endAt is nil |
| `apps/electron/src/renderer/src/App.tsx` | Add responsive padding and table overflow handling |
