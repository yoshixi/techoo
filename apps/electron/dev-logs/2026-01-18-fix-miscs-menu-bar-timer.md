# Menu Bar Timer Display Implementation

**Date**: 2026-01-18
**Branch**: fix-miscs
**Feature**: Display active timer in system tray/menu bar

## Overview

Implemented a feature to show the currently active timer in the macOS menu bar (and system tray tooltip for Windows/Linux).

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
