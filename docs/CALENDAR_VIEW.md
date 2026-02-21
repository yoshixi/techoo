---
title: "Calendar View Feature (Electron)"
brief_description: "This document introduces the Calendar view in the Electron renderer so other agents can safely update it."
created_at: "2026-01-17"
update_at: "2026-01-25"
---

# Calendar View Feature (Electron)

This document introduces the Calendar view in the Electron renderer so other agents can safely update it.

## Purpose

The Calendar view shows all tasks on a day/week timeline, supports drag-to-create and drag-to-move time ranges, and provides quick actions (edit, delete, start/stop timer) on task blocks. It also integrates a modal for creating a new task from a selected range.

## Key Files

- apps/electron/src/renderer/src/components/CalendarView.tsx
  - Main calendar UI: day/week grid, slot rendering, drag behaviors, current time line, and task block rendering.
- apps/electron/src/renderer/src/App.tsx
  - Calendar view integration and routing.
  - New task modal for calendar range creation.
  - Task move handler (updates startAt/endAt).
- apps/electron/src/renderer/src/components/TaskTimeRangePicker.tsx
  - Timeline-based picker used for schedule selection in the task modal.

## Behavior Summary

- Views: day and week.
- Slot granularity: dynamic (changes with zoom level).
- Visible range: 06:00 - 12:00, auto-scrolled to that range on open.
- Tasks:
  - Scheduled tasks are placed by startAt/endAt (endAt defaults to +30 minutes when missing).
  - Unscheduled tasks are not displayed in the calendar view.
  - Completed tasks use muted/gray styling.
  - Active timer tasks use red styling.
- Drag behaviors:
  - Drag empty space to create a new time range (calls onCreateRange).
  - Drag a task block to move it; duration is preserved (calls onTaskMove).
  - Drag top/bottom edges to resize a task.
- Zoom:
  - Use buttons or Cmd/Ctrl + scroll wheel to zoom in/out.
- Current time line:
  - A red horizontal line with a dot appears in today's column and updates every minute.

## Layout Strategy (Important)

Calendar height adapts to the window size:

- The container uses flex with min-h-0 so the calendar can shrink/grow with the window.
- The scroll area is a flex-1 container; slot height is derived from its clientHeight so the
  visible window (06:00-18:00) fills the available space without empty gaps.
- A ResizeObserver recalculates slotHeight to keep the grid aligned when the window size changes.

See comments inside apps/electron/src/renderer/src/components/CalendarView.tsx.

## Create Task from Calendar

Flow:
1) User drags a range in the calendar.
2) App sets calendarDraft with startAt/endAt and prefilled tagIds from active tag filters.
3) A modal opens with native datetime-local inputs for precise adjustments and fields for title/description/tags.
4) Create task calls postApiTasks and refreshes task lists.

Modal lives in apps/electron/src/renderer/src/App.tsx.

## Edit/Delete/Timer Actions

Calendar task blocks have action icons:
- Pencil opens the task modal.
- Trash deletes the task (uses existing delete handler).
- Play/Stop starts or stops the timer for the task.

The full block click does NOT open edit; only the pencil does.

## Example Usage

Basic usage in App:

<CalendarView
  className="flex-1 min-h-0"
  tasks={allTasks}
  onTaskEdit={(task) => setSelectedTask(task)}
  onTaskDelete={(task) => handleDeleteTask(task.id)}
  onTaskMove={(task, range) => handleCalendarMoveTask(task, range)}
  activeTimersByTaskId={activeTimersByTaskId}
  onTaskStartTimer={handleStartTimer}
  onTaskStopTimer={handleStopTimer}
  onCreateRange={({ startAt, endAt }) =>
    setCalendarDraft({ title: '', description: '', startAt, endAt, tagIds: filterTagIds })
  }
/>

## Notes / Gotchas

- Day index is derived from the active base date (start of day or week); tasks outside the view are not rendered.
- Drag-to-move uses document.elementFromPoint to detect the day column while dragging.
- Slot height affects all positioning; ensure new code uses slotHeight for any y-position math.
- When adjusting time granularity or visible range, update both CalendarView and TaskTimeRangePicker.

## Notes / Learnings

- Flex height issues required `min-h-0` on the flex container chain (`SidebarInset` and calendar wrappers). Without it, the calendar content expanded beyond the viewport and a single slot could fill the screen.
- The calendar scroll area must be `flex-1` inside a `min-h-0` parent to allow the grid to size to the window instead of its content.

## UI Design Principles (Session Preferences)

- Prefer flat UI: avoid shadows on cards, blocks, and popovers unless strictly necessary.
- Borders should be subtle (soft gray) rather than high-contrast black; avoid drawing too much attention to containers.
- Use muted separators and low-contrast outlines to keep focus on content, not chrome.
- Keep spacing consistent and avoid heavy visual weight around panels or inputs.
