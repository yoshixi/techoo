import React, { useMemo, useState } from 'react'
import { Play, CheckCircle, Maximize2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { TagCombobox } from '../TagCombobox'
import { useGetApiTasks, type Task, type TaskTimer } from '../../gen/api'
import { formatTimeRangeShort } from '../../lib/time'
import { groupTasksByDate, type GroupedTasks } from '../../lib/date-groups'

interface UpcomingTabProps {
  activeTimersByTaskId: Map<number, TaskTimer>
  onStartTimer: (taskId: number) => void
  onStopTimer: (taskId: number, timerId: number) => void
  onToggleCompletion: (task: Task) => void
  onTaskSelect: (task: Task) => void
  filterTagIds: number[]
  onFilterTagIdsChange: (ids: number[]) => void
}

export function UpcomingTab({
  activeTimersByTaskId,
  onStartTimer,
  onStopTimer,
  onToggleCompletion,
  onTaskSelect,
  filterTagIds,
  onFilterTagIdsChange
}: UpcomingTabProps): React.JSX.Element {
  const [showCompleted, setShowCompleted] = useState(false)

  const { data: tasksResponse, isLoading } = useGetApiTasks({
    scheduled: 'true' as const,
    completed: showCompleted ? undefined : ('false' as const),
    sortBy: 'startAt' as const,
    order: 'asc' as const,
    tags: filterTagIds.length ? filterTagIds : undefined
  })
  const tasks = tasksResponse?.tasks ?? []

  const groups: GroupedTasks[] = useMemo(() => groupTasksByDate(tasks), [tasks])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <TagCombobox
          selectedTagIds={filterTagIds}
          onSelectionChange={onFilterTagIdsChange}
          placeholder="Filter by tags"
          className="w-48"
        />
        <div className="flex items-center justify-between w-[140px] h-8 rounded-md border border-input px-3">
          <Label htmlFor="upcoming-show-completed" className="text-sm cursor-pointer">
            Completed
          </Label>
          <Switch
            id="upcoming-show-completed"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
            className="scale-75"
          />
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          Loading tasks...
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No upcoming tasks found.
        </div>
      )}

      {/* Grouped task list */}
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">
            {group.label} ({group.tasks.length})
          </h3>
          {group.tasks.map((task) => {
            const isActive = activeTimersByTaskId.has(task.id)
            const isCompleted = !!task.completedAt
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-lg border p-2 cursor-pointer hover:bg-muted/50 transition-colors ${isActive ? 'bg-primary/5' : ''} ${isCompleted ? 'opacity-50' : ''}`}
                onClick={() => onTaskSelect(task)}
              >
                {isActive ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      const timer = activeTimersByTaskId.get(task.id)
                      if (timer) onStopTimer(task.id, timer.id)
                    }}
                    className="h-7 w-7 hover:bg-red-100 shrink-0"
                    title="Stop timer"
                  >
                    <span className="h-4 w-4 rounded-sm bg-red-600 animate-pulse block" style={{ width: 12, height: 12 }} />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onStartTimer(task.id) }}
                    className="h-7 w-7 hover:bg-green-100 shrink-0"
                    title="Start timer"
                  >
                    <Play className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onToggleCompletion(task) }}
                  className={`h-7 w-7 shrink-0 ${isCompleted ? 'opacity-50' : 'hover:bg-green-100'}`}
                  title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  <CheckCircle className={`h-4 w-4 ${isCompleted ? 'text-gray-400' : 'text-green-600'}`} />
                </Button>
                <div className="text-xs text-muted-foreground w-28 shrink-0">
                  {formatTimeRangeShort(task.startAt, task.endAt)}
                </div>
                <div className={`flex-1 text-sm font-medium truncate ${isCompleted ? 'line-through' : ''}`}>
                  {task.title}
                </div>
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
                  onClick={(e) => { e.stopPropagation(); onTaskSelect(task) }}
                  className="h-7 w-7 hover:bg-blue-100 shrink-0"
                  title="Open details"
                >
                  <Maximize2 className="h-4 w-4 text-blue-600" />
                </Button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
