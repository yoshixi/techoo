import React, { useEffect, useState } from 'react'
import { CalendarDays, Clock4, Pencil, Trash2, Plus, Play, Pause, RotateCcw } from 'lucide-react'

import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './components/ui/table'
import { Textarea } from './components/ui/textarea'
import {
  deleteApiTasksId,
  postApiTasks,
  putApiTasksId,
  useGetApiTasks,
  type Task
} from './gen/api'

interface TaskTimer {
  id: string
  taskId: string
  startTime: string
  endTime?: string
  createdAt: string
  updatedAt: string
}

interface ActiveTimer {
  taskId: string
  timerId: string
  startTime: number
  elapsedTime: number
  isRunning: boolean
}

function App(): React.JSX.Element {
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks
  } = useGetApiTasks()
  const tasks = tasksResponse?.tasks ?? []
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskFields, setNewTaskFields] = useState({
    title: '',
    description: '',
    dueDate: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const totalTasks = tasksResponse?.total ?? tasks.length

  // Timer state
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null)
  // @ts-ignore - taskTimers is used in setTaskTimers calls
  const [taskTimers, setTaskTimers] = useState<TaskTimer[]>([])
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  async function handleCreateTask(): Promise<void> {
    if (!newTaskFields.title.trim()) return

    setIsCreating(true)
    try {
      await postApiTasks({
        title: newTaskFields.title.trim(),
        description: newTaskFields.description.trim(),
        dueDate: normalizeDueDate(newTaskFields.dueDate)
      })
      await mutateTasks()
      setNewTaskFields({ title: '', description: '', dueDate: '' })
      setIsAddingTask(false)
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsCreating(false)
    }
  }

  function handleCancelAdd(): void {
    setNewTaskFields({ title: '', description: '', dueDate: '' })
    setIsAddingTask(false)
  }

  async function handleDeleteTask(taskId: string): Promise<void> {
    setDeletingTaskId(taskId)
    try {
      await deleteApiTasksId(taskId)
      await mutateTasks()
      if (activeTimer?.taskId === taskId) {
        handleStopTimer()
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setDeletingTaskId(null)
    }
  }

  async function handleUpdateTask(updated: Task): Promise<void> {
    setSavingTaskId(updated.id)
    try {
      await putApiTasksId(updated.id, {
        title: updated.title,
        description: updated.description,
        dueDate: normalizeDueDate(updated.dueDate ?? '')
      })
      await mutateTasks()
      setEditingTask(null)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setSavingTaskId(null)
    }
  }

  // Timer functions
  function handleStartTimer(taskId: string): void {
    if (activeTimer) {
      // Stop current timer first
      handleStopTimer()
    }

    const now = new Date().toISOString()
    const timerId = createId()

    // Create a new timer record
    const newTimer: TaskTimer = {
      id: timerId,
      taskId,
      startTime: now,
      createdAt: now,
      updatedAt: now
    }

    setTaskTimers((prev) => [...prev, newTimer])
    setActiveTimer({
      taskId,
      timerId,
      startTime: Date.now(),
      elapsedTime: 0,
      isRunning: true
    })

    // Task timer started, no status change needed
  }

  function handlePauseTimer(): void {
    if (!activeTimer) return

    const elapsed = currentTime - activeTimer.startTime + activeTimer.elapsedTime
    setActiveTimer((prev) =>
      prev
        ? {
            ...prev,
            elapsedTime: elapsed,
            isRunning: false
          }
        : null
    )
  }

  function handleResumeTimer(): void {
    if (!activeTimer) return

    setActiveTimer((prev) =>
      prev
        ? {
            ...prev,
            startTime: Date.now() - prev.elapsedTime,
            isRunning: true
          }
        : null
    )
  }

  function handleStopTimer(): void {
    if (!activeTimer) return

    const now = new Date().toISOString()

    // Update the timer record with end time
    setTaskTimers((prev) =>
      prev.map((timer) =>
        timer.id === activeTimer.timerId ? { ...timer, endTime: now, updatedAt: now } : timer
      )
    )

    setActiveTimer(null)
  }

  function handleResetTimer(): void {
    if (!activeTimer) return

    // Remove the current timer record
    setTaskTimers((prev) => prev.filter((timer) => timer.id !== activeTimer.timerId))
    setActiveTimer(null)
  }

  function getTimerDisplay(taskId: string): string {
    if (activeTimer?.taskId === taskId) {
      const elapsed = activeTimer.isRunning
        ? currentTime - activeTimer.startTime + activeTimer.elapsedTime
        : activeTimer.elapsedTime

      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return '00:00'
  }

  function isTaskActive(taskId: string): boolean {
    return activeTimer?.taskId === taskId && activeTimer.isRunning
  }

  return (
    <div className="min-h-screen p-8">
      <main className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Clock4 className="h-4 w-4 text-primary" />
            Task Management
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Task List
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
            Manage your tasks in a simple table view
          </p>
        </header>

        {/* Task Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                {tasksLoading ? 'Loading tasks...' : `${totalTasks} task${totalTasks === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {!isAddingTask && (
                <Button onClick={() => setIsAddingTask(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingTask && (
                  <TableRow className="border-primary/50 bg-primary/5">
                    <TableCell>
                      <span className="text-muted-foreground text-sm">00:00</span>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Enter task title"
                        value={newTaskFields.title}
                        onChange={(e) =>
                          setNewTaskFields((prev) => ({ ...prev, title: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTask()
                          } else if (e.key === 'Escape') {
                            handleCancelAdd()
                          }
                        }}
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Enter description"
                        value={newTaskFields.description}
                        onChange={(e) =>
                          setNewTaskFields((prev) => ({ ...prev, description: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTask()
                          } else if (e.key === 'Escape') {
                            handleCancelAdd()
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={newTaskFields.dueDate}
                        onChange={(e) =>
                          setNewTaskFields((prev) => ({ ...prev, dueDate: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTask()
                          } else if (e.key === 'Escape') {
                            handleCancelAdd()
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleCreateTask}
                          disabled={!newTaskFields.title.trim() || isCreating}
                        >
                          {isCreating ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {tasksLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                )}
                {!tasksLoading && tasksError && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-destructive">
                      Failed to load tasks. {getErrorMessage(tasksError)}
                    </TableCell>
                  </TableRow>
                )}
                {!tasksLoading && !tasksError && tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No tasks found
                    </TableCell>
                  </TableRow>
                )}
                {!tasksLoading &&
                  !tasksError &&
                  tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className={isTaskActive(task.id) ? 'border-primary/70 bg-primary/10' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock4 className="h-4 w-4" />
                          <span className="font-mono text-sm min-w-[3rem]">
                            {getTimerDisplay(task.id)}
                          </span>
                          {activeTimer?.taskId === task.id ? (
                            <div className="flex gap-1">
                              {activeTimer.isRunning ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handlePauseTimer}
                                  className="h-6 w-6"
                                >
                                  <Pause className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleResumeTimer}
                                  className="h-6 w-6"
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleResetTimer}
                                className="h-6 w-6"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartTimer(task.id)}
                              className="h-6 w-6"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => setEditingTask(task)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={deletingTaskId === task.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <EditTaskDialog
        task={editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSubmit={handleUpdateTask}
        isSubmitting={!!editingTask && savingTaskId === editingTask.id}
      />
    </div>
  )
}

function EditTaskDialog({
  task,
  onOpenChange,
  onSubmit,
  isSubmitting
}: {
  task: Task | null
  onOpenChange: (open: boolean) => void
  onSubmit: (task: Task) => Promise<void> | void
  isSubmitting: boolean
}): React.JSX.Element | null {
  const [localTask, setLocalTask] = useState<Task | null>(task)

  useEffect(() => {
    setLocalTask(task)
  }, [task])

  if (!task || !localTask) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!localTask) return
    await onSubmit({ ...localTask, updatedAt: new Date().toISOString() })
  }

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Update the metadata and save.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={localTask.title}
              onChange={(event) => setLocalTask({ ...localTask, title: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={localTask.description}
              onChange={(event) => setLocalTask({ ...localTask, description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-due">Due date</Label>
            <Input
              id="edit-due"
              type="date"
              value={formatDateInput(localTask.dueDate)}
              onChange={(event) => setLocalTask({ ...localTask, dueDate: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: string }).error
    if (message) return message
  }
  return 'Please try again.'
}

function formatDateInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function normalizeDueDate(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  // Keep only the date portion and coerce to UTC midnight
  const [year, month, day] = value.split('-')
  if (year && month && day) {
    const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0))
    return utcDate.toISOString()
  }
  return date.toISOString()
}

function createId(): string {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export default App
