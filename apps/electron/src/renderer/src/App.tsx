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

interface Task {
  id: string
  title: string
  description: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

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

const seedTasks: Task[] = [
  {
    id: createId(),
    title: 'Draft research outline',
    description:
      'Translate the research brief in Spec.md into a clear outline with milestones and blockers.',
    dueDate: upcomingDate(0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: createId(),
    title: 'Prototype focus timer',
    description:
      'Pair timer controls with the task list and wire up the highlighting interactions described in the spec.',
    dueDate: upcomingDate(1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: createId(),
    title: 'Polish task details',
    description:
      'Tighten up the copy, task metadata, and shadcn components for consistent styling.',
    dueDate: upcomingDate(-1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

function App(): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskFields, setNewTaskFields] = useState({
    title: '',
    description: '',
    dueDate: ''
  })

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

  function handleCreateTask(): void {
    if (!newTaskFields.title.trim()) return

    const now = new Date().toISOString()
    const task: Task = {
      id: createId(),
      title: newTaskFields.title.trim(),
      description: newTaskFields.description.trim(),
      dueDate: newTaskFields.dueDate || undefined,
      createdAt: now,
      updatedAt: now
    }

    setTasks((prev) => [task, ...prev])
    setNewTaskFields({ title: '', description: '', dueDate: '' })
    setIsAddingTask(false)
  }

  function handleCancelAdd(): void {
    setNewTaskFields({ title: '', description: '', dueDate: '' })
    setIsAddingTask(false)
  }

  function handleDeleteTask(taskId: string): void {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))

    // Stop timer if this task was being timed
    if (activeTimer?.taskId === taskId) {
      handleStopTimer()
    }
  }

  function handleUpdateTask(updated: Task): void {
    setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)))
    setEditingTask(null)
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
              <CardDescription>Manage your task list</CardDescription>
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
                          disabled={!newTaskFields.title.trim()}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
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
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <EditTaskDialog
        task={editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSubmit={handleUpdateTask}
      />
    </div>
  )
}

function EditTaskDialog({
  task,
  onOpenChange,
  onSubmit
}: {
  task: Task | null
  onOpenChange: (open: boolean) => void
  onSubmit: (task: Task) => void
}): React.JSX.Element | null {
  const [localTask, setLocalTask] = useState<Task | null>(task)

  useEffect(() => {
    setLocalTask(task)
  }, [task])

  if (!task || !localTask) return null

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!localTask) return
    onSubmit({ ...localTask, updatedAt: new Date().toISOString() })
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
              value={localTask.dueDate ?? ''}
              onChange={(event) => setLocalTask({ ...localTask, dueDate: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
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

function upcomingDate(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function createId(): string {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

export default App
