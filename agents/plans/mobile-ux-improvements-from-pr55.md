# Mobile UX Improvements (ported from PR #55)

## Features

### 1. Duration Picker on QuickStartTask
- Add horizontal pill selector below the input: 15m, 30m (default), 1h, 1.5h, 2h
- Set `endAt = now + duration` when creating the task
- Auto-stop any running timers before starting new one

### 2. Countdown Badge on Running Tasks
- In `TaskListItem`, when a task has `endAt` and an active timer, show remaining time
- Format: "~12m left" (green) or "over by 5m" (amber/warning)
- Updates every second using the existing `useTimer` hook pattern

### 3. Timer Fill-Out Bottom Sheet
- When completing a task that has zero timer records → show bottom sheet
- Pre-fill start/end from the task's `startAt`/`endAt`
- User can adjust times, then "Record & Complete" or "Skip"
- Uses `@gorhom/bottom-sheet` for native mobile feel

### 4. Carryover Tasks Section
- Show in TaskList above TodayTasks section
- Query: incomplete tasks with `startAt` before today
- Actions per task:
  - **Move to Today**: Reschedule to now, preserving duration
  - **Skip**: Clear `startAt`/`endAt`
  - **Done**: Complete the task (with timer fill-out check)
- Collapsible section with count badge

## Files to modify
- `components/tasks/QuickStartTask.tsx` - duration picker + auto-stop
- `components/tasks/TaskListItem.tsx` - countdown badge
- `components/tasks/TaskList.tsx` - carryover section integration
- `components/tasks/CarryoverSection.tsx` - new component
- `components/tasks/TimerFillSheet.tsx` - new bottom sheet
- `hooks/useTimer.ts` - add countdown mode
