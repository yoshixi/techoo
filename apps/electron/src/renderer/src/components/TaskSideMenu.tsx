import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { putApiTasksId, type Task } from '../gen/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { TimerManager } from './TimerManager'

interface TaskSideMenuProps {
  task: Task | null
  onClose: () => void
  onTaskUpdated?: (task: Task) => void
  enableEditing?: boolean
}

export const TaskSideMenu: React.FC<TaskSideMenuProps> = ({
  task,
  onClose,
  onTaskUpdated,
  enableEditing = false
}) => {
  const [localTask, setLocalTask] = useState<Task | null>(task)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

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
    setLocalTask(task)
  }, [task])

  if (!task) return null

  const handleTimerStarted = (): void => {
    window.api?.openFloatingTaskWindow?.({ taskId: task.id })
  }

  const handleTimerStopped = (): void => {
    window.api?.closeFloatingTaskWindow?.(task.id)
  }

  const handleSave = async (): Promise<void> => {
    if (!localTask) return
    setIsSaving(true)
    try {
      await putApiTasksId(localTask.id, {
        title: localTask.title?.trim(),
        description: localTask.description?.trim(),
        dueDate: normalizeDueDate(localTask.dueDate ?? '')
      })
      onTaskUpdated?.({ ...localTask, updatedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setIsSaving(false)
    }
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
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Description
              </h4>
              {enableEditing ? (
                <div className="mt-3 space-y-3">
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
                    <Label htmlFor="task-due-date">Due date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={formatDateInput(localTask?.dueDate)}
                      onChange={(event) =>
                        setLocalTask((prev) =>
                          prev ? { ...prev, dueDate: event.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              ) : currentTask?.description ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                  {currentTask.description}
                </p>
              ) : (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No description provided.
                </p>
              )}
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Details
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium text-foreground">
                  {isCompleted ? 'Completed' : 'To Do'}
                </dd>

                {isCompleted && (
                  <>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="text-foreground">
                      {currentTask?.completedAt
                        ? new Date(currentTask.completedAt).toLocaleString()
                        : '—'}
                    </dd>
                  </>
                )}

                <dt className="text-muted-foreground">Due Date</dt>
                <dd className="text-foreground">
                  {currentTask?.dueDate ? new Date(currentTask.dueDate).toLocaleDateString() : 'None'}
                </dd>

                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  {currentTask?.createdAt ? new Date(currentTask.createdAt).toLocaleDateString() : '—'}
                </dd>

                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-foreground">
                  {currentTask?.updatedAt ? new Date(currentTask.updatedAt).toLocaleDateString() : '—'}
                </dd>
              </dl>
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

function formatDateInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function normalizeDueDate(value: string): string | undefined {
  if (!value) return undefined
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
  if (isoDatePattern.test(value)) {
    const [year, month, day] = value.split('-')
    const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return utcDate.toISOString()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}
