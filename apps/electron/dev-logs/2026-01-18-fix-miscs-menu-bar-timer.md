# Menu Bar Timer Display Implementation

**Date**: 2026-01-18
**Branch**: fix-miscs
**Feature**: Display active timer in system tray/menu bar with hover popover

## Overview

Implemented a feature to show the currently active timer in the macOS menu bar (and system tray tooltip for Windows/Linux), with a hover popover that shows timer details on macOS.

## Architecture

```
Renderer (App.tsx)                   Main Process (tray.ts)
      │                                   │
      │  activeTimersByTaskId changes     │
      │  ──────────────────────────────►  │
      │  IPC: 'timer:state-change'        │
      │                                   │
      │                                   │  ──► Tray.setTitle() [macOS]
      │                                   │  ──► Tray.setToolTip() [all]
```

## Files Created

### `apps/electron/src/main/tray.ts`
TrayManager class responsible for:
- Creating and managing the system tray
- Receiving timer state updates via IPC
- Running a 1-second interval to update elapsed time display
- Providing context menu (Show Shuchu, Quit)
- Handling tray click to show/focus main window

### Tray Icons
Created by resizing existing logo using `sips`:
```sh
sips -z 22 22 logo.png --out tray-icon.png
sips -z 16 16 logo.png --out tray-iconTemplate.png
sips -z 32 32 logo.png --out tray-iconTemplate@2x.png
```

- `tray-iconTemplate.png` (16x16) - macOS menu bar (Template suffix for light/dark mode)
- `tray-iconTemplate@2x.png` (32x32) - macOS retina
- `tray-icon.png` (22x22) - Windows/Linux

## Files Modified

### `apps/electron/src/main/index.ts`
- Added import for TrayManager
- Added `trayManager` variable
- Added IPC handler for `timer:state-change`
- Initialize TrayManager after window creation in `app.whenReady()`
- Added cleanup on `before-quit` event

### `apps/electron/src/preload/index.ts`
Added `updateTimerState` method to the api object:
```typescript
updateTimerState: (state: { taskId: string; taskTitle: string; startTime: string } | null): void => {
  ipcRenderer.send('timer:state-change', state)
}
```

### `apps/electron/src/preload/index.d.ts`
Added TypeScript declarations for `TimerState` interface and `updateTimerState` method.

### `apps/electron/src/renderer/src/App.tsx`
Added two effects:
1. Sync active timer state to main process when `activeTimersByTaskId` changes
2. Cleanup effect to clear timer state on component unmount

## Cross-Platform Behavior

| Platform | Timer Display | Tooltip |
|----------|---------------|---------|
| macOS | `Tray.setTitle(' 12:34')` in menu bar | Task title + time |
| Windows | N/A (no menu bar title support) | Task title + time on hover |
| Linux | N/A | Task title + time on hover |

## Testing Checklist

- [x] Type checking passes (`pnpm run check-types`)
- [ ] Tray icon appears on app launch
- [ ] No active timer: macOS shows no title, tooltip shows "No active timer"
- [ ] Timer starts: macOS shows elapsed time, tooltip shows task + time
- [ ] Timer updates every second
- [ ] Timer stops: display clears
- [ ] Click tray icon: main window shows and focuses
- [ ] Context menu works (Show Shuchu, Quit)
- [ ] App quit: tray icon removed properly

## Notes

- The TrayManager uses its own `setInterval` (1 second) to calculate and display elapsed time, rather than receiving tick updates from the renderer. This reduces IPC overhead.
- macOS template icons (with `Template` suffix) automatically adapt to light/dark mode.
- Timer state is sent from renderer to main only when it changes (start/stop), not every second.

---

## Native Menu on Hover (macOS only)

### Overview

Replaced custom React popover with native macOS context menu that appears on hover. This provides a more native look and feel.

### Native Menu Layout

```
┌─────────────────────────────┐
│ Task title here...          │  (disabled, shows current task)
│ ⏱ 12:34                     │  (disabled, shows elapsed time)
│ ─────────────────────────── │
│ ■ Stop Timer                │  (clickable, stops the timer)
│ ─────────────────────────── │
│ Show Shuchu                 │  (clickable, shows main window)
│ ─────────────────────────── │
│ Quit                        │  (clickable, quits app)
└─────────────────────────────┘
```

When no timer is running:
```
┌─────────────────────────────┐
│ No active timer             │  (disabled)
│ ─────────────────────────── │
│ Show Shuchu                 │
│ ─────────────────────────── │
│ Quit                        │
└─────────────────────────────┘
```

### Implementation

#### `apps/electron/src/main/tray.ts`
- Simplified to use native `Menu` via `popUpContextMenu()` on `mouse-enter`
- Context menu updates every second to show current elapsed time
- Added `setOnStopTimer()` callback to handle stop timer action
- Removed all custom popover window code

#### `apps/electron/src/main/index.ts`
- Removed popover-related IPC handlers
- Added `tray:stop-timer-request` IPC to forward stop request to renderer
- Wired up `setOnStopTimer()` callback

#### `apps/electron/src/preload/index.ts`
- Removed `getTimerState()` and `onTimerStateUpdate()` (no longer needed)
- Added `onStopTimerRequest()` to listen for stop timer requests from tray

#### `apps/electron/src/renderer/src/App.tsx`
- Added effect to listen for `onStopTimerRequest` and stop the active timer via API

#### Removed Files
- `apps/electron/src/renderer/src/components/TrayPopover.tsx` (no longer needed)

### Testing Checklist

- [ ] Hover over tray icon shows native menu (macOS)
- [ ] Menu shows "No active timer" when no timer running
- [ ] Menu shows task title and elapsed time when timer running
- [ ] "Stop Timer" button stops the active timer
- [ ] "Show Shuchu" opens main window
- [ ] "Quit" exits the app

---

## Multiple Timers Support

### Overview

Updated to support multiple active timers simultaneously. Each timer is shown in the context menu with its task title and elapsed time.

### Menu Bar Title

- **0 timers**: No title (just icon)
- **1 timer**: `1 timer`
- **2+ timers**: `N timers`

### Context Menu Layout (Multiple Timers)

```
┌────────────────────────────────┐
│ Task A                  12:34  │  ← click to stop
│ Task B                  05:21  │  ← click to stop
│ Task C                  01:45  │  ← click to stop
│ ────────────────────────────── │
│ Show Shuchu                    │
│ ────────────────────────────── │
│ Quit                           │
└────────────────────────────────┘
```

Timers are sorted by most recent start time (newest first).

### Implementation Changes

#### `apps/electron/src/main/tray.ts`
- `TimerState` now includes `timerId` field
- `activeTimers: TimerState[]` instead of single `currentTimerState`
- `updateTimerStates(timers[])` instead of `updateTimerState(state)`
- `setOnStopTimer((timerId) => ...)` - callback receives specific timer ID
- Context menu shows all timers, each clickable to stop that specific timer
- Menu bar title shows count: "1 timer" or "N timers"

#### `apps/electron/src/main/index.ts`
- IPC channel renamed: `timer:states-change` (plural)
- Stop callback passes `timerId` to renderer

#### `apps/electron/src/preload/index.ts` & `index.d.ts`
- `updateTimerStates(timers[])` instead of `updateTimerState(state)`
- `onStopTimerRequest((timerId) => ...)` receives timer ID

#### `apps/electron/src/renderer/src/App.tsx`
- Sync effect sends all active timers as array
- Stop handler finds timer by ID and stops that specific one

### Testing Checklist

- [ ] Menu bar shows "1 timer" with one active timer
- [ ] Menu bar shows "2 timers" with two active timers
- [ ] Context menu shows all active timers
- [ ] Timers sorted by most recent start time
- [ ] Clicking a timer row opens task detail modal
- [ ] Timer count updates when starting/stopping timers

---

## Click Timer to Show Task Detail

### Overview

Changed the behavior when clicking a timer in the context menu: instead of stopping the timer, it now shows the main window and opens the task detail modal.

### Behavior

1. User hovers over tray icon → context menu appears
2. User clicks on a timer row (e.g., "Task A  12:34")
3. Main window is shown and focused
4. Task detail modal opens for that task

### Implementation Changes

#### `apps/electron/src/main/tray.ts`
- Renamed `onStopTimer` → `onShowTaskDetail`
- Menu click now calls `showMainWindow()` then `onShowTaskDetail(taskId)`

#### `apps/electron/src/main/index.ts`
- IPC channel: `tray:show-task-detail` (was `tray:stop-timer-request`)

#### `apps/electron/src/preload/index.ts` & `index.d.ts`
- `onShowTaskDetail((taskId) => ...)` instead of `onStopTimerRequest`

#### `apps/electron/src/renderer/src/App.tsx`
- Listens for `onShowTaskDetail`, finds task by ID, sets `selectedTask` to open modal
