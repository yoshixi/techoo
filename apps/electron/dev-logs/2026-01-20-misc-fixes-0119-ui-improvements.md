# UI Improvements and Keyboard Shortcuts

**Date**: 2026-01-20
**Branch**: misc-fixes-0119
**Features**: Table scrolling, UI reorganization, zoom shortcuts

## Overview

Implemented several UI improvements including scrollable tasks table, reorganized filter controls, always-visible complete button, and application menu with working zoom shortcuts.

---

## 1. Scrollable Tasks Table

### Problem
When there were many tasks, the table would extend beyond the viewport and users couldn't scroll to see all tasks.

### Solution
Made the Tasks card fill remaining space with internal scrolling while keeping controls and headers fixed.

### Files Modified

#### `apps/electron/src/renderer/src/App.tsx`
- Outer container: Added `flex flex-1 min-h-0 flex-col` to create proper flex context
- Main content: Added `flex flex-col min-h-0 flex-1 gap-6` for vertical stacking
- Controls section: Added `shrink-0` to prevent shrinking
- In Progress Card: Changed `mb-6` to `shrink-0`
- Tasks Card: Added `flex flex-col min-h-0 flex-1` to fill remaining space
- CardHeader: Added `shrink-0` to keep header visible
- CardContent: Added `flex-1 min-h-0 overflow-y-auto` for scrollable content

---

## 2. Reorganized Filter/Sort Controls

### Problem
Filter and sort controls were in a separate section above both cards, taking up vertical space.

### Solution
Moved filter/sort controls, tag selector, and "Add Task" button into the Tasks CardHeader, next to the title.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Tasks                    Sort by: [▼] Show completed [□] Tags: │
│ 5 tasks                                        [All tags ▼] [+]│
├─────────────────────────────────────────────────────────────────┤
│ Time Tracked | Start Date | Title | Description | Tags | Actions│
│ ...scrollable content...                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Always-Visible Complete Button

### Problem
The complete (checkmark) button was only visible for tasks that had timers.

### Solution
Removed the `hasTimers(task.id) &&` condition from the complete button, making it visible for all tasks.

### Files Modified

#### `apps/electron/src/renderer/src/App.tsx`
- Removed conditional rendering around the CheckCircle button
- Removed unused `hasTimers()` function

---

## 4. Application Menu with Zoom Shortcuts

### Problem
Cmd+/Cmd- keyboard shortcuts for zooming didn't work because there was no application menu set up.

### Solution
Added a full application menu with Edit, View, and Window menus. Implemented custom zoom handlers with global shortcut fallback for reliability.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+= | Zoom In |
| Cmd+- | Zoom Out |
| Cmd+0 | Reset Zoom (Actual Size) |

### Implementation Details

The built-in Electron zoom roles (`zoomIn`, `zoomOut`, `resetZoom`) have known issues on some keyboard layouts. The solution uses:

1. **Custom menu items** with explicit accelerators and `webContents.setZoomLevel()` handlers
2. **Global shortcut fallback** for `CommandOrControl+-` to ensure it works across all keyboard layouts

### Files Modified

#### `apps/electron/src/main/index.ts`

**New imports:**
```typescript
import { ..., Menu, globalShortcut } from 'electron'
```

**New function: `createApplicationMenu()`**
Creates standard macOS/Windows application menu with:
- App menu (macOS only): About, Services, Hide, Quit
- Edit menu: Undo, Redo, Cut, Copy, Paste, Select All
- View menu: Reload, DevTools, Zoom In/Out/Reset, Fullscreen
- Window menu: Minimize, Zoom, etc.

**Zoom implementation:**
```typescript
{
  label: 'Zoom Out',
  accelerator: 'CommandOrControl+-',
  click: (): void => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel()
      focusedWindow.webContents.setZoomLevel(currentZoom - 0.5)
    }
  }
}
```

**Global shortcut fallback:**
```typescript
globalShortcut.register('CommandOrControl+-', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  if (focusedWindow) {
    const currentZoom = focusedWindow.webContents.getZoomLevel()
    focusedWindow.webContents.setZoomLevel(currentZoom - 0.5)
  }
})
```

**Cleanup on quit:**
```typescript
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  // ...
})
```

---

## Testing Checklist

- [x] Type checking passes (`pnpm run check-types`)
- [ ] Tasks table scrolls when content overflows
- [ ] Filter/sort controls appear in Tasks card header
- [ ] Complete button visible for all tasks (with or without timers)
- [ ] Cmd+= zooms in
- [ ] Cmd+- zooms out
- [ ] Cmd+0 resets zoom to 100%
- [ ] Application menu appears in menu bar (macOS)

---

## 5. Sophisticated Filter/Sort Controls with shadcn Components

### Problem
The filter/sort controls were using a plain HTML `<select>` element which didn't match the rest of the UI styling.

### Solution
Replaced native HTML select with shadcn Select component and improved the overall layout of controls.

### New UI Components Used
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` from shadcn
- `ArrowUpDown` icon from lucide-react for sort indicator
- `Label` component for the "Show completed" toggle

### Layout Changes
- Sort dropdown now uses shadcn Select with an ArrowUpDown icon
- "Show completed" toggle wrapped in a bordered container for visual consistency
- All controls use consistent height (`h-8`)
- Button uses `size="sm"` for better proportion

### Code Example
```tsx
<Select value={sortBy} onValueChange={(value) => setSortBy(value as 'createdAt' | 'startAt')}>
  <SelectTrigger className="w-[140px] h-8">
    <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
    <SelectValue placeholder="Sort by" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="startAt">Start Date</SelectItem>
    <SelectItem value="createdAt">Created Date</SelectItem>
  </SelectContent>
</Select>

<div className="flex items-center gap-2 rounded-md border border-input px-3 h-8">
  <Label htmlFor="show-completed" className="text-xs whitespace-nowrap cursor-pointer">
    Show completed
  </Label>
  <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} className="scale-75" />
</div>
```

---

## Known Issues / Notes

- Electron's built-in zoom roles have known issues (see [electron/electron#19559](https://github.com/electron/electron/issues/19559))
- Global shortcuts are registered as fallback for keyboard layouts where menu accelerators don't work
- Zoom level changes by 0.5 per step (approximately 12% per step)
