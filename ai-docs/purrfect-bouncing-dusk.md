# Mobile App Implementation Plan

## Overview

Implement a React Native mobile app (apps/mobile) that replicates the Electron app functionality with mobile-optimized UX.

**Tech Stack:** Expo 54, React Native 0.81.5, NativeWind/Tailwind, react-native-reusables, SWR, Orval (OpenAPI client)

---

## Phase 1: Foundation & API Integration

### 1.1 Install Dependencies
```bash
pnpm --filter mobile add swr @gorhom/bottom-sheet @react-native-community/datetimepicker orval -D
```

### 1.2 API Client Setup
- Create `orval.config.js` (mirror Electron's config)
- Create `lib/api/mutator.ts` (custom fetch for React Native)
- Add `openapi.json` from web app
- Add scripts to `package.json`:
  - `"gen:openapi": "cp ../web/openapi.json ./openapi.json || true"`
  - `"orval:generate": "orval --config ./orval.config.js"`
  - `"api:generate": "pnpm run gen:openapi && pnpm run orval:generate"`

### 1.3 Navigation Structure
Create tab-based navigation:
```
app/
├── (tabs)/
│   ├── _layout.tsx    # Tab navigator
│   ├── index.tsx      # Tasks list
│   ├── calendar.tsx   # Calendar view
│   └── settings.tsx   # Settings
└── task/
    └── [id].tsx       # Task detail (modal)
```

### 1.4 Base UI Components
Port from react-native-reusables:
- `components/ui/input.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/separator.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/switch.tsx`

---

## Phase 2: Tasks List View

### 2.1 Core Components
- `components/tasks/TaskList.tsx` - Main list with FlatList
- `components/tasks/TaskListItem.tsx` - Single task row with swipe actions
- `components/tasks/InProgressSection.tsx` - Active timer tasks section
- `components/tasks/TaskFilters.tsx` - Sort/filter controls
- `components/tasks/CreateTaskSheet.tsx` - Bottom sheet for new task

### 2.2 Features
- Pull-to-refresh
- Swipe actions (complete/delete)
- Filter: show completed toggle
- Filter: by tags (horizontal pills)
- Sort: by start date / created date
- "In Progress" section for tasks with active timers

### 2.3 Timer Integration
- Timer display in list items
- Start/stop button
- Real-time elapsed time (useTimer hook)

---

## Phase 3: Task Detail View

### 3.1 Components
- `app/task/[id].tsx` - Full-screen task detail
- `components/tasks/TaskDetailContent.tsx` - Main content
- `components/timer/TimerDisplay.tsx` - Large timer
- `components/timer/TimerControls.tsx` - Start/stop
- `components/timer/TimerHistory.tsx` - Past sessions
- `components/tags/TagPicker.tsx` - Multi-select bottom sheet
- `components/comments/CommentsSection.tsx` - Comments list + input
- `components/activities/ActivityTimeline.tsx` - Combined timeline

### 3.2 Features
- Editable title, description, schedule
- Auto-save with debounce (800ms)
- Native date/time picker for schedule
- Complete/incomplete toggle
- Tag management
- Comments CRUD
- Timer management

---

## Phase 4: Calendar View

### 4.1 Components
- `components/calendar/CalendarView.tsx` - Main container
- `components/calendar/CalendarHeader.tsx` - Navigation (prev/next/today)
- `components/calendar/DayColumn.tsx` - Single day timeline
- `components/calendar/TimeSlot.tsx` - Hourly slot
- `components/calendar/TaskBlock.tsx` - Task visualization
- `components/calendar/CurrentTimeIndicator.tsx` - Red line

### 4.2 Features
- Day view (default)
- Week view toggle
- Tasks as colored blocks
- Green = active timer, gray = completed
- Tap task to open detail
- Long-press empty slot to create task
- Current time indicator

---

## Phase 5: Polish & Settings

### 5.1 Settings Screen
- API URL configuration
- Theme toggle (light/dark)
- App version info

### 5.2 Error Handling
- Network error states
- Empty states
- Loading skeletons
- Pull-to-refresh retry

---

## Key Files to Create/Modify

### New Files
```
apps/mobile/
├── orval.config.js
├── openapi.json
├── lib/
│   ├── api/
│   │   └── mutator.ts
│   └── time.ts
├── hooks/
│   ├── useTimer.ts
│   └── useAutoSave.ts
├── gen/api/              # Generated
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── calendar.tsx
│   │   └── settings.tsx
│   └── task/
│       └── [id].tsx
└── components/
    ├── ui/               # Additional shadcn components
    ├── tasks/
    ├── timer/
    ├── calendar/
    ├── tags/
    ├── comments/
    └── activities/
```

### Files to Reference (Electron)
- `apps/electron/orval.config.js` - API config pattern
- `apps/electron/src/renderer/src/lib/api/mutator.ts` - Fetch wrapper
- `apps/electron/src/renderer/src/components/TaskManager.tsx` - Task list logic
- `apps/electron/src/renderer/src/components/TimerManager.tsx` - Timer logic
- `apps/electron/src/renderer/src/components/CalendarView.tsx` - Calendar logic

---

## Mobile UX Adaptations

| Desktop (Electron) | Mobile |
|-------------------|--------|
| Side panel for task detail | Full-screen modal or bottom sheet |
| Drag to create/move tasks | Long-press to create, tap to view |
| Hover buttons | Swipe gestures |
| Dropdown combobox | Bottom sheet picker |
| Floating timer window | In-app timer display |
| Sidebar navigation | Bottom tab bar |

---

## Verification

After implementation:
1. Run `pnpm --filter mobile run dev` to start Expo
2. Test on iOS Simulator / Android Emulator
3. Verify API connection: create task, start timer, add comment
4. Test calendar view: navigate days, view tasks
5. Run `pnpm run check-types` for type safety
