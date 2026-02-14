# Tasks View Tabbed Refactor

**Date:** 2026-02-11
**Branch:** shuchu-settings-ui

## What was implemented

Refactored the monolithic Tasks view (~1750 lines in App.tsx) into 3 focused tabbed sub-views:

1. **Now Tab** — Quick Capture (create task + auto-start timer), Running Tasks with live elapsed time, Today's Schedule
2. **Upcoming Tab** — All scheduled tasks grouped by date (Today/Tomorrow/This Week/Later) with tag filters
3. **Review Tab** — Daily hours bar chart (14 days), time by tag chart, task summary table with total time and sessions

### Key architectural changes:
- Extracted `useTasksData` hook with all task/timer fetching and mutations
- Created `TasksView` container with Radix UI Tabs
- App.tsx reduced from ~1750 to ~560 lines
- Added `date-groups.ts` and `timer-aggregation.ts` utility libraries

## Commands executed

```sh
devenv shell -- pnpm --filter electron add @radix-ui/react-tabs recharts
devenv shell -- pnpm run check-types
```

## Files created

- `components/ui/tabs.tsx`
- `hooks/useTasksData.ts`
- `components/TasksView.tsx`
- `components/tabs/NowTab.tsx`
- `components/tabs/UpcomingTab.tsx`
- `components/tabs/ReviewTab.tsx`
- `lib/date-groups.ts`
- `lib/timer-aggregation.ts`

## Files modified

- `App.tsx` — Replaced inline tasks section with `<TasksView />`
- `package.json` — Added @radix-ui/react-tabs and recharts deps
