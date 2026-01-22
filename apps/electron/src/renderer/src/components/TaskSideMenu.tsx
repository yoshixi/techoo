import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, X, Check } from 'lucide-react'
import { putApiTasksId, useGetApiTasksIdActivities, type Task } from '../gen/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { TimerManager } from './TimerManager'
import { TagCombobox } from './TagCombobox'
import { formatDateTimeInput, normalizeDateTime } from '../lib/time'
import { CommentsPanel } from './CommentsPanel'
import { TaskActivities } from './TaskActivities'
import { TaskTimeRangePicker } from './TaskTimeRangePicker'

const AUTO_SAVE_DELAY_MS = 800

interface TaskSideMenuProps {
  task: Task | null
  onClose: () => void
  onTaskUpdated?: (task: Task) => void
}

// Helper to check if editable fields have changed
function hasEditableChanges(current: Task | null, saved: Task | null): boolean {
  if (!current || !saved) return false
  return (
    current.title !== saved.title ||
    current.description !== saved.description ||
    current.startAt !== saved.startAt ||
    current.endAt !== saved.endAt
  )
}

export const TaskSideMenu: React.FC<TaskSideMenuProps> = ({
  task,
  onClose,
  onTaskUpdated
}) => {
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const scheduleContainerRef = useRef<HTMLDivElement | null>(null)
  const [localTask, setLocalTask] = useState<Task | null>(task)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the last saved state to compare against
  const lastSavedTaskRef = useRef<Task | null>(task)
  const activitiesQuery = useGetApiTasksIdActivities(task?.id ?? '', {
    swr: { enabled: Boolean(task?.id) }
  })

  const currentTask = localTask ?? task
  const isCompleted = Boolean(currentTask?.completedAt)

  useEffect(() => {
    if (!task) return undefined
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [task, onClose])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        scheduleContainerRef.current &&
        !scheduleContainerRef.current.contains(event.target as Node)
      ) {
        setIsScheduleOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Reset state when task prop changes
  useEffect(() => {
    setLocalTask(task)
    lastSavedTaskRef.current = task
    // Clear any pending save timer when switching tasks
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (titleInputRef.current) {
      requestAnimationFrame(() => {
        titleInputRef.current?.blur()
      })
    }
  }, [task])

  // Auto-save function
  const performSave = useCallback(async (taskToSave: Task): Promise<void> => {
    setIsSaving(true)
    try {
      await putApiTasksId(taskToSave.id, {
        title: taskToSave.title?.trim(),
        description: taskToSave.description?.trim(),
        startAt: normalizeDateTime(taskToSave.startAt ?? ''),
        endAt: normalizeDateTime(taskToSave.endAt ?? '')
      })
      // Update the last saved reference after successful save
      lastSavedTaskRef.current = taskToSave
      onTaskUpdated?.({ ...taskToSave, updatedAt: new Date().toISOString() })

      // Show saved indicator
      setShowSaved(true)
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current)
      }
      savedIndicatorTimerRef.current = setTimeout(() => {
        setShowSaved(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsSaving(false)
    }
  }, [onTaskUpdated])

  // Debounced auto-save effect - only triggers when there are actual changes
  useEffect(() => {
    // Clear existing timer first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Only schedule save if there are actual changes
    if (!localTask || !hasEditableChanges(localTask, lastSavedTaskRef.current)) {
      return
    }

    // Set new timer for auto-save
    debounceTimerRef.current = setTimeout(() => {
      performSave(localTask)
    }, AUTO_SAVE_DELAY_MS)

    // Cleanup on unmount or when localTask changes
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [localTask, performSave])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current)
      }
    }
  }, [])

  if (!task) return null

  const handleTimerStarted = (): void => {
    window.api?.openFloatingTaskWindow?.({ taskId: task.id, title: task.title })
  }

  const handleTimerStopped = (): void => {
    window.api?.closeFloatingTaskWindow?.(task.id)
  }

  const handleToggleCompletion = async (): Promise<void> => {
    if (!currentTask) return
    setIsCompleting(true)
    try {
      const response = await putApiTasksId(currentTask.id, {
        completedAt: currentTask.completedAt ? null : new Date().toISOString()
      })
      setLocalTask(response.task)
      onTaskUpdated?.(response.task)
    } catch (error) {
      console.error('Failed to update completion status:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleTagsChange = async (tagIds: string[]): Promise<void> => {
    if (!currentTask) return
    try {
      const response = await putApiTasksId(currentTask.id, { tagIds })
      setLocalTask(response.task)
      lastSavedTaskRef.current = response.task
      onTaskUpdated?.(response.task)
    } catch (error) {
      console.error('Failed to update tags:', error)
    }
  }

  return (
    <div className="flex h-full max-h-[80vh] flex-col rounded-[32px] bg-white/95 shadow-[0_40px_120px_rgba(15,23,42,0.2)] ring-1 ring-black/5">
      <header className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex flex-1 items-center gap-4">
          <div className="min-w-0 space-y-2 flex-1">
            <Input
              ref={titleInputRef}
              value={localTask?.title ?? ''}
              onChange={(event) =>
                setLocalTask((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
              className="text-lg font-semibold"
            />
          </div>
          <div className="flex items-center gap-2">
            {task && (
              <TimerManager
                taskId={task.id}
                mode="compact"
                onTimerStarted={handleTimerStarted}
                onTimerStopped={handleTimerStopped}
                onActivityRecorded={() => activitiesQuery.mutate?.()}
                isCompleted={isCompleted}
                onToggleCompletion={handleToggleCompletion}
                isCompleting={isCompleting}
              />
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close details">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Schedule</Label>
              <div ref={scheduleContainerRef} className="relative">
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="datetime-local"
                    value={formatDateTimeInput(localTask?.startAt)}
                    onChange={(event) =>
                      setLocalTask((prev) =>
                        prev ? { ...prev, startAt: event.target.value } : prev
                      )
                    }
                    className="h-9 flex-1 min-w-[200px]"
                  />
                  <Input
                    type="datetime-local"
                    value={formatDateTimeInput(localTask?.endAt)}
                    onChange={(event) =>
                      setLocalTask((prev) =>
                        prev ? { ...prev, endAt: event.target.value } : prev
                      )
                    }
                    className="h-9 flex-1 min-w-[200px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsScheduleOpen((prev) => !prev)}
                    aria-label="Open schedule picker"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </div>
                {isScheduleOpen && (
                  <div className="absolute z-40 mt-2 w-[min(520px,90vw)] rounded-md border bg-white p-3 shadow-lg">
                    <TaskTimeRangePicker
                      startAt={localTask?.startAt}
                      endAt={localTask?.endAt}
                      onChange={({ startAt, endAt }) => {
                        setLocalTask((prev) =>
                          prev ? { ...prev, startAt, endAt } : prev
                        )
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Tags</Label>
              <TagCombobox
                selectedTagIds={localTask?.tags?.map((t) => t.id) ?? []}
                onSelectionChange={handleTagsChange}
                placeholder="Add tags..."
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={localTask?.description ?? ''}
              onChange={(event) =>
                setLocalTask((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev
                )
              }
              rows={4}
            />
          </div>
          <div className="h-6 flex items-center">
            {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
            {showSaved && !isSaving && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </section>

        <section className="mt-1">
          <TaskActivities
            activities={activitiesQuery.data?.activities}
            isLoading={activitiesQuery.isLoading}
            error={activitiesQuery.error}
          />
        </section>

        <section className="mt-4">
          <CommentsPanel
            taskId={task.id}
            onCommentCreated={() => activitiesQuery.mutate?.()}
          />
        </section>
      </div>
    </div>
  )
}
