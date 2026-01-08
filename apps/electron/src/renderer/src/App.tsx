import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock4, Trash2, Plus, Play, Pause } from 'lucide-react'

import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './components/ui/table'
import { Switch } from './components/ui/switch'
import {
  deleteApiTasksId,
  postApiTasks,
  postApiTimers,
  putApiTasksId,
  putApiTimersId,
  useGetApiTasks,
  useGetApiTimers,
  type Task,
  type TaskTimer
} from './gen/api'
import { TaskSideMenu } from './components/TaskSideMenu'
function App(): React.JSX.Element {
  const [showCompleted, setShowCompleted] = useState(false)
  const taskQuery = useMemo(
    () => (showCompleted ? undefined : { completed: 'false' as const }),
    [showCompleted]
  )
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks
  } = useGetApiTasks(taskQuery)
  const tasks = tasksResponse?.tasks ?? []
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskFields, setNewTaskFields] = useState({
    title: '',
    description: '',
    dueDate: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'title' | 'description' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const totalTasks = tasksResponse?.total ?? tasks.length

  const [currentTime, setCurrentTime] = useState(Date.now())
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks])

  const {
    data: timersResponse,
    error: timersError,
    isLoading: timersLoading,
    mutate: mutateTimers
  } = useGetApiTimers(taskIds.length ? { taskIds } : undefined, {
    swr: { enabled: taskIds.length > 0 }
  })
  const timers = timersResponse?.timers ?? []
  const activeTimersByTaskId = useMemo(() => {
    const map = new Map<string, TaskTimer>()
    timers.forEach((timer) => {
      if (!timer.endTime) {
        const existing = map.get(timer.taskId)
        if (!existing) {
          map.set(timer.taskId, timer)
          return
        }
        const existingStart = new Date(existing.startTime).getTime()
        const nextStart = new Date(timer.startTime).getTime()
        if (nextStart > existingStart) {
          map.set(timer.taskId, timer)
        }
      }
    })
    return map
  }, [timers])

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
      const activeTimer = activeTimersByTaskId.get(taskId)
      if (activeTimer) {
        await handleStopTimer(taskId, activeTimer.id)
      }
      await deleteApiTasksId(taskId)
      await mutateTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setDeletingTaskId(null)
    }
  }

  function handleStartEditing(taskId: string, field: 'title' | 'description', currentValue: string): void {
    setEditingCell({ taskId, field })
    setEditingValue(currentValue || '')
  }

  function handleCancelEditing(): void {
    setEditingCell(null)
    setEditingValue('')
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingCell) return

    const task = tasks.find(t => t.id === editingCell.taskId)
    if (!task) return

    try {
      await putApiTasksId(editingCell.taskId, {
        [editingCell.field]: editingValue.trim()
      })
      await mutateTasks()
      setEditingCell(null)
      setEditingValue('')
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  async function handleStartTimer(taskId: string): Promise<void> {
    try {
      await postApiTimers({
        taskId,
        startTime: new Date().toISOString()
      })
      await mutateTimers()
      window.api.openFloatingTaskWindow({ taskId })
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  async function handleStopTimer(taskId: string, timerId: string): Promise<void> {
    try {
      await putApiTimersId(timerId, {
        endTime: new Date().toISOString()
      })
      await mutateTimers()
      window.api.closeFloatingTaskWindow(taskId)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  function getTimerDisplay(taskId: string): string {
    const activeTimer = activeTimersByTaskId.get(taskId)
    if (activeTimer) {
      const elapsed = currentTime - new Date(activeTimer.startTime).getTime()
      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return '00:00'
  }

  function isTaskActive(taskId: string): boolean {
    return activeTimersByTaskId.has(taskId)
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

        {timersError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            Failed to load timers.
          </div>
        )}

        {/* Task Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                {tasksLoading
                  ? 'Loading tasks...'
                  : `${totalTasks} task${totalTasks === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show completed</span>
                <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
              </div>
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
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${isTaskActive(task.id) ? 'border-primary/70 bg-primary/10' : ''}`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Clock4 className="h-4 w-4" />
                          <span className="font-mono text-sm min-w-[3rem]">
                            {getTimerDisplay(task.id)}
                          </span>
                          {activeTimersByTaskId.has(task.id) ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const activeTimer = activeTimersByTaskId.get(task.id)
                                if (activeTimer) {
                                  handleStopTimer(task.id, activeTimer.id)
                                }
                              }}
                              className="h-6 w-6"
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartTimer(task.id)}
                              className="h-6 w-6"
                              disabled={timersLoading}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className="font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEditing(task.id, 'title', task.title)
                        }}
                      >
                        {editingCell?.taskId === task.id && editingCell?.field === 'title' ? (
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                handleCancelEditing()
                              }
                            }}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <span className="cursor-text hover:underline">{task.title}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEditing(task.id, 'description', task.description || '')
                        }}
                      >
                        {editingCell?.taskId === task.id && editingCell?.field === 'description' ? (
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit()
                              } else if (e.key === 'Escape') {
                                handleCancelEditing()
                              }
                            }}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <span className="cursor-text hover:underline truncate block">{task.description || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
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

      <TaskSideMenu
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={async (updated) => {
          // Update the currently selected task reference (to keep the side-menu UI in sync)
          setSelectedTask(updated)
          await mutateTasks()
        }}
      />
    </div>
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

function normalizeDueDate(value?: string | null): string | undefined {
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

export default App
