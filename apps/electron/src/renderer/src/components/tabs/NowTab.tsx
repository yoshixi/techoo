import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, Play, Square, Trash2 } from 'lucide-react'
import { CharacterIllustration } from '../CharacterIllustration'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { TagCombobox } from '../TagCombobox'
import { useGetApiTasks, type Task, type TaskTimer } from '../../gen/api'
import { formatTimeRangeShort, getTodayRange } from '../../lib/time'

interface NowTabProps {
  activeTasks: Task[]
  activeTimersByTaskId: Map<number, TaskTimer>
  onStartTimer: (taskId: number) => void
  onStopTimer: (taskId: number, timerId: number) => void
  onCreateTaskAndStartTimer: (title: string, tagIds?: number[]) => void
  onDeleteTask: (taskId: number) => void
  onTaskSelect: (task: Task) => void
  filterTagIds: number[]
}

function formatElapsed(startTime: string): string {
  const start = new Date(startTime).getTime()
  const elapsed = Math.floor((Date.now() - start) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function RunningTaskCard({
  task,
  timer,
  onStop,
  onSelect
}: {
  task: Task
  timer: TaskTimer
  onStop: () => void
  onSelect: () => void
}): React.JSX.Element {
  const [elapsed, setElapsed] = useState(() => formatElapsed(timer.startTime))

  useEffect(() => {
    const interval = setInterval(() => setElapsed(formatElapsed(timer.startTime)), 1000)
    return () => clearInterval(interval)
  }, [timer.startTime])

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onSelect}
    >
      <Circle className="h-2.5 w-2.5 text-timer-active fill-timer-active animate-breathe shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.title}</div>
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <span className="text-sm font-mono text-muted-foreground shrink-0">{elapsed}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => { e.stopPropagation(); onStop() }}
        className="h-7 shrink-0"
      >
        <Square className="h-3 w-3 mr-1 text-destructive" />
        Pause
      </Button>
    </div>
  )
}

export function NowTab({
  activeTasks,
  activeTimersByTaskId,
  onStartTimer,
  onStopTimer,
  onCreateTaskAndStartTimer,
  onDeleteTask,
  onTaskSelect,
  filterTagIds
}: NowTabProps): React.JSX.Element {
  const [quickTitle, setQuickTitle] = useState('')
  const [quickTagIds, setQuickTagIds] = useState<number[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleQuickCreate = useCallback(() => {
    if (!quickTitle.trim()) return
    onCreateTaskAndStartTimer(quickTitle.trim(), quickTagIds.length > 0 ? quickTagIds : undefined)
    setQuickTitle('')
    setQuickTagIds([])
    setShowTagPicker(false)
  }, [quickTitle, quickTagIds, onCreateTaskAndStartTimer])

  // Today's schedule: inactive, scheduled tasks for today
  const todayRange = getTodayRange()
  const { data: todayTasksResponse } = useGetApiTasks({
    hasActiveTimer: 'false' as const,
    scheduled: 'true' as const,
    startAtFrom: todayRange.startAt,
    startAtTo: todayRange.endAt,
    sortBy: 'startAt' as const,
    order: 'asc' as const,
    completed: 'false' as const,
    tags: filterTagIds.length ? filterTagIds : undefined
  })
  const todayTasks = todayTasksResponse?.tasks ?? []

  // Running tasks with timers
  const runningTasks = activeTasks.filter((t) => activeTimersByTaskId.has(t.id))

  return (
    <div className="space-y-6">
      {/* Quick Capture */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Start Something</h3>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="What would you like to focus on?"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickCreate()
            }}
            className="flex-1"
          />
          {showTagPicker && (
            <TagCombobox
              selectedTagIds={quickTagIds}
              onSelectionChange={setQuickTagIds}
              onClose={() => setShowTagPicker(false)}
              placeholder="Tags"
              className="w-36"
            />
          )}
          {!showTagPicker && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowTagPicker(true)}
              className="shrink-0 text-xs text-muted-foreground"
            >
              + Tags
            </Button>
          )}
          <Button
            onClick={handleQuickCreate}
            disabled={!quickTitle.trim()}
            className="shrink-0"
          >
            <Play className="h-4 w-4 mr-1" />
            Let's Go
          </Button>
        </div>
      </div>

      {/* Running Tasks */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Focusing Now {runningTasks.length > 0 && `(${runningTasks.length})`}
        </h3>
        {runningTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-3">
            <CharacterIllustration mood="encouraging" size="md" className="mx-auto" />
            <p>All clear! Ready when you are.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runningTasks.map((task) => {
              const timer = activeTimersByTaskId.get(task.id)!
              return (
                <RunningTaskCard
                  key={task.id}
                  task={task}
                  timer={timer}
                  onStop={() => onStopTimer(task.id, timer.id)}
                  onSelect={() => onTaskSelect(task)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Today's Schedule */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Today's Schedule {todayTasks.length > 0 && `(${todayTasks.length})`}
        </h3>
        {todayTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground space-y-3">
            <CharacterIllustration mood="thinking" size="md" className="mx-auto" />
            <p>Nothing on the schedule today. Enjoy the calm!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onTaskSelect(task)}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onStartTimer(task.id) }}
                  className="h-7 w-7 hover:bg-green-200 shrink-0"
                  title="Start timer"
                >
                  <Play className="h-4 w-4 text-green-700" />
                </Button>
                <div className="text-xs text-muted-foreground w-28 shrink-0">
                  {formatTimeRangeShort(task.startAt, task.endAt)}
                </div>
                <div className="flex-1 text-sm font-medium truncate">{task.title}</div>
                {task.tags && task.tags.length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {task.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id) }}
                  className="h-7 w-7 hover:bg-destructive/10 shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
