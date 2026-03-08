# Quick Switch Task UX

## Problem

When users are focused on a task and something urgent comes up, the current flow requires manual steps: pause the current timer, type a new task, start it. The "Start Something" input should handle this seamlessly — if a timer is running, starting a new task should auto-stop the current one. Users should also be able to estimate how long the new task will take, so the task is created with proper `startAt` and `endAt`.

## Design Principles

- **No backend changes** — compose existing APIs. Task creation already supports `startAt` and `endAt`.
- **No extra state** — no paused task tracking, no localStorage. Just stop the old timer and start the new one.
- **Minimal UI change** — enhance the existing "Start Something" input row

## Mock UI

### State 1: Idle (no timer running)

```
START SOMETHING
┌──────────────────────────────────┐                                    ┌──────────┐
│ What would you like to focus on? │  + Tags   [15m] [30m] [1h] [__]m  │ ▶ Let's Go│
└──────────────────────────────────┘           ~~~~~                    └──────────┘
                                              selected (default)

FOCUSING NOW (0)
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
          (character illustration: encouraging)
│              All clear! Ready when you are.                    │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

TODAY'S SCHEDULE (2)
┌───────────────────────────────────────────────────────────────────────┐
│  ▶  ✓  09:00–10:00   Write quarterly report              🏷 work  🗑 │
│  ▶  ✓  10:30–11:00   Review PR #142                      🏷 dev   🗑 │
└───────────────────────────────────────────────────────────────────────┘
```

### State 2: User types a task and picks duration

```
START SOMETHING
┌──────────────────────────────────┐                                    ┌──────────┐
│ Reply to Alice's question        │  + Tags   [15m] [30m] [1h] [__]m  │ ▶ Let's Go│
└──────────────────────────────────┘                    ~~~~~           └──────────┘
                                                       selected (1h)
```

### State 3: After clicking "Let's Go" (timer was running on "Write quarterly report")

The old timer auto-stops. New task starts with `startAt=now`, `endAt=now+1h`.

```
START SOMETHING
┌──────────────────────────────────┐                                    ┌──────────┐
│ What would you like to focus on? │  + Tags   [15m] [30m] [1h] [__]m  │ ▶ Let's Go│
└──────────────────────────────────┘           ~~~~~                    └──────────┘

FOCUSING NOW (1)
┌───────────────────────────────────────────────────────────────────────┐
│  [■] [✓]  ●  Reply to Alice's question         03:24     ~47m left  │
│               🏷 dev                                                 │
└───────────────────────────────────────────────────────────────────────┘
  pause complete  ↑ breathing dot                        ↑ countdown

TODAY'S SCHEDULE (2)
┌───────────────────────────────────────────────────────────────────────┐
│  ▶  ✓  09:00–10:00   Write quarterly report              🏷 work  🗑 │
│  ▶  ✓  10:30–11:00   Review PR #142                      🏷 dev   🗑 │
└───────────────────────────────────────────────────────────────────────┘
     ↑ user can restart any of these later
```

### State 4: Countdown expired (over time)

```
FOCUSING NOW (1)
┌───────────────────────────────────────────────────────────────────────┐
│  [■] [✓]  ●  Reply to Alice's question        1:07:24  ⚠ over by 7m│
│               🏷 dev                                                 │
└───────────────────────────────────────────────────────────────────────┘
  pause complete                                         ↑ amber warning
```

### Component Layout Breakdown

```
NowTab
├── "Start Something" section
│   └── Row: [ Input ]  [ +Tags ]  [ DurationPicker ]  [ Let's Go ]
│                                     ├── 15m pill
│                                     ├── 30m pill (default, selected)
│                                     ├── 1h pill
│                                     └── custom [__]m input
│
├── "Focusing Now" section
│   └── RunningTaskCard
│       ├── [■ Pause] button (left side)
│       ├── [✓ Complete] button (left side)
│       ├── ● breathing dot
│       ├── title + tags
│       ├── elapsed time
│       └── CountdownBadge (Phase 2: "~Xm left" or "⚠ over by Xm")
│
└── "Today's Schedule" section (existing, unchanged)
    └── task rows with ▶ ✓ time title tags 🗑
```

## UI Details

### Duration Picker

- Sits between the text input (+ Tags) and "Let's Go" button
- Pill buttons: `15m`, `30m`, `1h` + a small custom input field (number + "m")
- Default selection: **30m**
- Always visible (not just when a timer is running — knowing duration is always useful)
- Selected pill has filled/primary style, others are outline

### Countdown Badge (Phase 2)

- Shows on RunningTaskCard when the task has an `endAt`
- Normal: `~12m left` in muted text
- Over time: `⚠ over by 3m` in amber/warning color
- Calculated from task's `endAt` vs current time, no extra state needed

### Behavior on "Let's Go"

1. If a timer is running, auto-stop it
2. Create task with `startAt = now` and `endAt = now + selected duration`
3. Start timer on the new task

## Implementation

### NowTab Changes

Add duration state and the selector UI:

```typescript
// In NowTab component
const [quickDurationMinutes, setQuickDurationMinutes] = useState(30)

// Pass to handler
onCreateTaskAndStartTimer(quickTitle.trim(), tagIds, quickDurationMinutes)
```

New `DurationPicker` component (inline, not a popover):

```typescript
function DurationPicker({
  value,
  onChange
}: {
  value: number
  onChange: (minutes: number) => void
}) {
  const presets = [15, 30, 60]
  const isCustom = !presets.includes(value)

  return (
    <div className="flex items-center gap-1">
      {presets.map(m => (
        <Button
          key={m}
          size="sm"
          variant={value === m ? 'default' : 'outline'}
          onClick={() => onChange(m)}
          className="h-7 px-2 text-xs"
        >
          {m >= 60 ? `${m / 60}h` : `${m}m`}
        </Button>
      ))}
      <Input
        type="number"
        min={1}
        value={isCustom ? value : ''}
        placeholder="__"
        onChange={e => onChange(Number(e.target.value) || 30)}
        className="h-7 w-12 text-xs text-center"
      />
      <span className="text-xs text-muted-foreground">m</span>
    </div>
  )
}
```

### useTasksData Changes

Update `handleCreateTaskAndStartTimer` signature and logic:

```typescript
const handleCreateTaskAndStartTimer = useCallback(async (
  title: string,
  tagIds?: number[],
  durationMinutes?: number
) => {
  const now = new Date()
  const startAt = now.toISOString()
  const endAt = durationMinutes
    ? new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString()
    : undefined

  // Auto-stop any running timer
  const runningTask = activeTasks.find(t => activeTimersByTaskId.has(t.id))
  if (runningTask) {
    const timer = activeTimersByTaskId.get(runningTask.id)!
    await handleStopTimer(runningTask.id, timer.id)
  }

  // Create task with startAt + endAt, then start timer
  const task = await postApiTasks({ title, tagIds, startAt, endAt })
  await postApiTimers({ taskId: task.id })
  mutateBothTaskLists()
}, [...])
```

### Props Change

```typescript
// NowTabProps
onCreateTaskAndStartTimer: (title: string, tagIds?: number[], durationMinutes?: number) => void
```

## Implementation Phases

### Phase 1: Duration Picker + Auto-Stop ✅
- Add `DurationPicker` component to NowTab input row (left of "Let's Go")
- Default to 30m, presets: 15m, 30m, 1h + custom input
- Pass `durationMinutes` to `handleCreateTaskAndStartTimer`
- Create task with `startAt = now`, `endAt = now + duration`
- Auto-stop running timer before creating new task

### Phase 2: Countdown Badge ✅
- Show remaining time on RunningTaskCard based on task's `endAt`
- Badge turns amber when past `endAt`

### Phase 3: Electron Notifications ✅
- Existing `NotificationScheduler` already handles task end notifications
- Tasks with `endAt` + active timers automatically get notified 1 minute before ending
- No additional code changes required — infrastructure covers this out of the box
