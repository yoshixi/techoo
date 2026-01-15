import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import { putApiTasksId, type Task } from '../gen/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { TimerManager } from './TimerManager'
import { TagCombobox } from './TagCombobox'
import { formatDateTimeInput, normalizeDateTime } from '../lib/time'

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
    current.startAt !== saved.startAt
  )
}

export const TaskSideMenu: React.FC<TaskSideMenuProps> = ({
  task,
  onClose,
  onTaskUpdated
}) => {
  const [localTask, setLocalTask] = useState<Task | null>(task)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the last saved state to compare against
  const lastSavedTaskRef = useRef<Task | null>(task)

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

  // Reset state when task prop changes
  useEffect(() => {
    setLocalTask(task)
    lastSavedTaskRef.current = task
    // Clear any pending save timer when switching tasks
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [task])

  // Auto-save function
  const performSave = useCallback(async (taskToSave: Task): Promise<void> => {
    setIsSaving(true)
    try {
      await putApiTasksId(taskToSave.id, {
        title: taskToSave.title?.trim(),
        description: taskToSave.description?.trim(),
        startAt: normalizeDateTime(taskToSave.startAt ?? '')
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
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-2xl">
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-6 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Task Details
              </p>
              <h3
                className="truncate text-lg font-semibold text-foreground"
                title={currentTask?.title}
              >
                {currentTask?.title}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isCompleted ? 'outline' : 'default'}
                onClick={handleToggleCompletion}
                disabled={isCompleting}
              >
                {isCompleting
                  ? 'Updating...'
                  : isCompleted
                    ? 'Mark Incomplete'
                    : 'Mark Complete'}
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close details">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Edit Task
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Title</Label>
                  <Input
                    id="task-title"
                    value={localTask?.title ?? ''}
                    onChange={(event) =>
                      setLocalTask((prev) =>
                        prev ? { ...prev, title: event.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="task-start-date">Start date & time</Label>
                  <Input
                    id="task-start-date"
                    type="datetime-local"
                    value={formatDateTimeInput(localTask?.startAt)}
                    onChange={(event) =>
                      setLocalTask((prev) =>
                        prev ? { ...prev, startAt: event.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <TagCombobox
                    selectedTagIds={localTask?.tags?.map((t) => t.id) ?? []}
                    onSelectionChange={handleTagsChange}
                    placeholder="Add tags..."
                  />
                </div>
                <div className="h-6 flex items-center">
                  {isSaving && (
                    <span className="text-xs text-muted-foreground">Saving...</span>
                  )}
                  {showSaved && !isSaving && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Timers
              </h4>
              <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4">
                <TimerManager
                  taskId={task.id}
                  onTimerStarted={handleTimerStarted}
                  onTimerStopped={handleTimerStopped}
                />
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  )
}
