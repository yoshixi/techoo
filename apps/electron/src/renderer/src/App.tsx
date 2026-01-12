import React, { useEffect, useMemo, useState } from 'react'
import { Clock4, Plus, Play, Square, CheckCircle, Maximize2 } from 'lucide-react'

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
import { AppSidebar } from './components/Sidebar'
import { SettingsView } from './components/SettingsView'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import { formatDateTime, normalizeDueDate, normalizeDateTime } from './lib/time'

type View = 'tasks' | 'settings'

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<View>('tasks')
  const [showCompleted, setShowCompleted] = useState(false)
  const [sortBy, setSortBy] = useState<'createdAt' | 'startAt'>('startAt')
  const taskQuery = useMemo(
    () => ({
      completed: showCompleted ? undefined : ('false' as const),
      sortBy,
      order: 'asc' as const
    }),
    [showCompleted, sortBy]
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
    dueDate: '',
    startAt: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'title' | 'description' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
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

  const totalTimeByTaskId = useMemo(() => {
    const map = new Map<string, number>()
    timers.forEach((timer) => {
      const startTime = new Date(timer.startTime).getTime()
      const endTime = timer.endTime ? new Date(timer.endTime).getTime() : currentTime
      const duration = endTime - startTime
      const currentTotal = map.get(timer.taskId) || 0
      map.set(timer.taskId, currentTotal + duration)
    })
    return map
  }, [timers, currentTime])

  // Split tasks into active (timer running) and inactive
  const { activeTasks, inactiveTasks } = useMemo(() => {
    const active: Task[] = []
    const inactive: Task[] = []
    tasks.forEach((task) => {
      if (activeTimersByTaskId.has(task.id)) {
        active.push(task)
      } else {
        inactive.push(task)
      }
    })
    return { activeTasks: active, inactiveTasks: inactive }
  }, [tasks, activeTimersByTaskId])

  // Update current time every minute for timer display
  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(Date.now())

    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  async function handleCreateTask(): Promise<void> {
    if (!newTaskFields.title.trim()) return

    setIsCreating(true)
    try {
      await postApiTasks({
        title: newTaskFields.title.trim(),
        description: newTaskFields.description.trim(),
        dueDate: normalizeDueDate(newTaskFields.dueDate),
        startAt: normalizeDateTime(newTaskFields.startAt)
      })
      await mutateTasks()
      setNewTaskFields({ title: '', description: '', dueDate: '', startAt: '' })
      setIsAddingTask(false)
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsCreating(false)
    }
  }

  function handleCancelAdd(): void {
    setNewTaskFields({ title: '', description: '', dueDate: '', startAt: '' })
    setIsAddingTask(false)
  }

  function handleOpenFloatingWindow(taskId: string): void {
    window.api.openFloatingTaskWindow({ taskId })
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
      setCurrentTime(Date.now()) // Update time display immediately
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
      setCurrentTime(Date.now()) // Update time display immediately
      window.api.closeFloatingTaskWindow(taskId)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  function getTotalTimeDisplay(taskId: string): string {
    const totalMs = totalTimeByTaskId.get(taskId) || 0
    const hours = Math.floor(totalMs / 3600000)
    const minutes = Math.floor((totalMs % 3600000) / 60000)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    if (minutes > 0) {
      return `${minutes}m`
    }
    return '0m'
  }

  function isTaskActive(taskId: string): boolean {
    return activeTimersByTaskId.has(taskId)
  }

  function hasTimers(taskId: string): boolean {
    return timers.some(timer => timer.taskId === taskId)
  }

  async function handleToggleTaskCompletion(task: Task): Promise<void> {
    setCompletingTaskId(task.id)
    try {
      await putApiTasksId(task.id, {
        completedAt: task.completedAt ? null : new Date().toISOString()
      })
      await mutateTasks()
    } catch (error) {
      console.error('Failed to update task completion:', error)
    } finally {
      setCompletingTaskId(null)
    }
  }

  function renderTaskRow(task: Task): React.JSX.Element {
    return (
      <TableRow
        key={task.id}
        className={`cursor-pointer hover:bg-muted/50 transition-colors ${isTaskActive(task.id) ? 'bg-primary/5' : ''}`}
        onClick={() => setSelectedTask(task)}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Clock4 className="h-4 w-4" />
            <span className="text-sm min-w-[3rem]">
              {getTotalTimeDisplay(task.id)}
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
                className="h-7 w-7 hover:bg-red-100"
                title="Stop timer"
              >
                <Square className="h-4 w-4 text-red-600 animate-pulse" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleStartTimer(task.id)}
                className="h-7 w-7 hover:bg-green-100"
                disabled={timersLoading}
                title="Start timer"
              >
                <Play className="h-4 w-4 text-green-600" />
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell>
          {task.startAt ? formatDateTime(task.startAt) : 'No start time'}
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
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {hasTimers(task.id) && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleToggleTaskCompletion(task)}
                disabled={completingTaskId === task.id}
                title={task.completedAt ? 'Mark incomplete' : 'Mark complete'}
                className={task.completedAt ? 'opacity-50' : 'hover:bg-green-100'}
              >
                <CheckCircle className={`h-4 w-4 ${task.completedAt ? 'text-gray-400' : 'text-green-600'}`} />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleOpenFloatingWindow(task.id)}
              title="Open floating window"
              className="hover:bg-blue-100"
            >
              <Maximize2 className="h-4 w-4 text-blue-600" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  function renderTableHeader(): React.JSX.Element {
    return (
      <TableHeader>
        <TableRow>
          <TableHead>Time Tracked</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      <SidebarInset>
        {currentView === 'settings' ? (
          <SettingsView />
        ) : (
          <div className="p-8">
            <main className="mx-auto max-w-6xl">
              {timersError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  Failed to load timers.
                </div>
              )}

              {/* Controls */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'startAt')}
                      className="rounded px-2 py-1 text-sm bg-background"
                    >
                      <option value="startAt">Start Date</option>
                      <option value="createdAt">Created Date</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Show completed</span>
                    <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
                  </div>
                </div>
                {!isAddingTask && (
                  <Button onClick={() => setIsAddingTask(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                )}
              </div>

              {/* In Progress Section */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    In Progress
                  </CardTitle>
                  <CardDescription>
                    {activeTasks.length} task{activeTasks.length === 1 ? '' : 's'} with timer running
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    {renderTableHeader()}
                    <TableBody>
                      {tasksLoading && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Loading tasks...
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && activeTasks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No tasks in progress
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && activeTasks.map(renderTaskRow)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Upcoming Tasks Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>
                    {tasksLoading
                      ? 'Loading tasks...'
                      : `${inactiveTasks.length} task${inactiveTasks.length === 1 ? '' : 's'}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    {renderTableHeader()}
                    <TableBody>
                      {isAddingTask && (
                        <TableRow className="bg-primary/5">
                          <TableCell>
                            <span className="text-muted-foreground text-sm">0m</span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="datetime-local"
                              value={newTaskFields.startAt}
                              onChange={(e) =>
                                setNewTaskFields((prev) => ({ ...prev, startAt: e.target.value }))
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
                      {!tasksLoading && !tasksError && inactiveTasks.length === 0 && !isAddingTask && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No tasks found
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && !tasksError && inactiveTasks.map(renderTaskRow)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </main>
          </div>
        )}

        <TaskSideMenu
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={async (updated) => {
            // Update the currently selected task reference (to keep the side-menu UI in sync)
            setSelectedTask(updated)
            await mutateTasks()
          }}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: string }).error
    if (message) return message
  }
  return 'Please try again.'
}

export default App
