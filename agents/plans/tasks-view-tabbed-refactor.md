# Plan: Refactor Tasks View into 3 Tabbed Sub-Views (Now, Upcoming, Review)

## Context

The Tasks view was a monolithic data table in `App.tsx` (~1750 lines) handling task creation, monitoring, planning, and review. This refactor splits it into 3 focused tabs optimized for distinct workflows.

## Architecture

### Data Layer: `hooks/useTasksData.ts`

Extracted from App.tsx all task/timer fetching, derived state, and mutation functions into a shared hook:
- SWR queries: active tasks, inactive tasks, sidebar active tasks, timers
- Derived state: `activeTimersByTaskId`, `timersByTaskId`, `allTasks`, `displayTasks`
- All mutations with optimistic updates
- New: `handleCreateTaskAndStartTimer` compound operation for Quick Capture

### Tab Components

1. **NowTab** — Daily cockpit
   - Quick Capture bar (input + Start button, creates task AND starts timer)
   - Running Tasks section (live elapsed time, stop button)
   - Today's Schedule (separate SWR query for today's inactive scheduled tasks)

2. **UpcomingTab** — Planning view
   - All scheduled tasks grouped by date (Today/Tomorrow/This Week/Later)
   - Tag filter + show completed toggle
   - Play/stop timer, completion toggle per task

3. **ReviewTab** — Productivity view
   - Daily bar chart (past 14 days, recharts)
   - Tag breakdown (horizontal bar chart)
   - Task summary table (total time, sessions)

### Assembly: `components/TasksView.tsx`

Radix Tabs container that owns tab state and routes to tab components.

## New Dependencies

- `@radix-ui/react-tabs` — Consistent with existing Radix stack
- `recharts` — React charting for Review tab

## Files Created

| File | Purpose |
|---|---|
| `components/ui/tabs.tsx` | Radix Tabs primitive |
| `hooks/useTasksData.ts` | Shared data layer hook |
| `components/TasksView.tsx` | Tabs container |
| `components/tabs/NowTab.tsx` | Now tab |
| `components/tabs/UpcomingTab.tsx` | Upcoming tab |
| `components/tabs/ReviewTab.tsx` | Review tab |
| `lib/date-groups.ts` | Group tasks by date |
| `lib/timer-aggregation.ts` | Aggregate timer durations |

## Files Modified

| File | Changes |
|---|---|
| `App.tsx` | Replaced monolithic tasks section with `<TasksView />`, consumes `useTasksData` hook (~560 lines, down from ~1750) |
