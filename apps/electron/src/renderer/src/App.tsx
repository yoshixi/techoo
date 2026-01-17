import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock4, Plus, Play, Square, CheckCircle, Maximize2 } from 'lucide-react'

import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Label } from './components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './components/ui/table'
import { Switch } from './components/ui/switch'
import { Badge } from './components/ui/badge'
import { TagCombobox } from './components/TagCombobox'
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
import { AppSidebar } from './components/Sidebar'
import { SettingsView } from './components/SettingsView'
import { SidebarProvider, SidebarInset, useSidebar } from './components/ui/sidebar'
import { Dialog, DialogContent } from './components/ui/dialog'
import { formatDateTime, formatDateTimeInput, normalizeDueDate, normalizeDateTime } from './lib/time'
import { CalendarView } from './components/CalendarView'

type View = 'tasks' | 'calendar' | 'settings'

// Keyboard shortcut definitions
type KeyBinding = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

const keyMaps = {
  NEW_TASK: { key: 'n', metaKey: true },
  TOGGLE_SIDEBAR: { key: 'e', metaKey: true },
  TOGGLE_TIMER: { key: ' ' },
  NAVIGATE_NEXT: { key: 'Tab' },
  NAVIGATE_PREV: { key: 'Tab', shiftKey: true }
} as const satisfies Record<string, KeyBinding>

function matchesKeyBinding(e: KeyboardEvent, binding: KeyBinding): boolean {
  const metaOrCtrl = binding.metaKey ? (e.metaKey || e.ctrlKey) : true
  const shift = binding.shiftKey ? e.shiftKey : !e.shiftKey
  return e.key === binding.key && metaOrCtrl && shift
}

// Keyboard shortcut handler component (must be inside SidebarProvider)
function KeyboardShortcuts({
  onNewTask,
  onToggleTimer,
  onNavigateNext,
  onNavigatePrev,
  isAddingTask,
  isEditing
}: {
  onNewTask: () => void
  onToggleTimer: () => void
  onNavigateNext: () => void
  onNavigatePrev: () => void
  isAddingTask: boolean
  isEditing: boolean
}): null {
  const { toggleSidebar } = useSidebar()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Command/Ctrl + N: New task
      if (matchesKeyBinding(e, keyMaps.NEW_TASK)) {
        e.preventDefault()
        if (!isAddingTask) {
          onNewTask()
        }
        return
      }

      // Command/Ctrl + E: Toggle sidebar
      if (matchesKeyBinding(e, keyMaps.TOGGLE_SIDEBAR)) {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Don't handle other shortcuts if adding task or editing
      if (isAddingTask || isEditing) return

      // Space: Toggle timer
      if (matchesKeyBinding(e, keyMaps.TOGGLE_TIMER)) {
        e.preventDefault()
        onToggleTimer()
        return
      }

      // Tab: Navigate tasks
      if (matchesKeyBinding(e, keyMaps.NAVIGATE_PREV)) {
        e.preventDefault()
        onNavigatePrev()
        return
      }

      if (matchesKeyBinding(e, keyMaps.NAVIGATE_NEXT)) {
        e.preventDefault()
        onNavigateNext()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, onNewTask, onToggleTimer, onNavigateNext, onNavigatePrev, isAddingTask, isEditing])

  return null
}

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<View>('tasks')
  const [showCompleted, setShowCompleted] = useState(false)
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'createdAt' | 'startAt'>('startAt')
  const [calendarDraft, setCalendarDraft] = useState<{
    title: string
    description: string
    startAt: string
    endAt: string
    tagIds: string[]
  } | null>(null)
  const [isCreatingCalendarTask, setIsCreatingCalendarTask] = useState(false)

  // Query for tasks with active timers (In Progress section)
  const activeTaskQuery = useMemo(
    () => ({
      completed: currentView === 'calendar' ? undefined : (showCompleted ? undefined : ('false' as const)),
      hasActiveTimer: 'true' as const,
      sortBy,
      order: 'asc' as const,
      tags: filterTagIds.length ? filterTagIds : undefined
    }),
    [showCompleted, sortBy, filterTagIds, currentView]
  )
  const {
    data: activeTasksResponse,
    error: activeTasksError,
    isLoading: activeTasksLoading,
    mutate: mutateActiveTasks
  } = useGetApiTasks(activeTaskQuery)
  const activeTasks = activeTasksResponse?.tasks ?? []

  // Query for tasks without active timers (Tasks section)
  const inactiveTaskQuery = useMemo(
    () => ({
      completed: currentView === 'calendar' ? undefined : (showCompleted ? undefined : ('false' as const)),
      hasActiveTimer: 'false' as const,
      sortBy,
      order: 'asc' as const,
      tags: filterTagIds.length ? filterTagIds : undefined
    }),
    [showCompleted, sortBy, filterTagIds, currentView]
  )
  const {
    data: inactiveTasksResponse,
    error: inactiveTasksError,
    isLoading: inactiveTasksLoading,
    mutate: mutateInactiveTasks
  } = useGetApiTasks(inactiveTaskQuery)
  const inactiveTasks = inactiveTasksResponse?.tasks ?? []

  // Combined tasks for operations that need to find a task
  const allTasks = useMemo(() => [...activeTasks, ...inactiveTasks], [activeTasks, inactiveTasks])
  const tasksLoading = activeTasksLoading || inactiveTasksLoading
  const tasksError = activeTasksError || inactiveTasksError

  // Helper to mutate both task lists
  const mutateBothTaskLists = useCallback(() => {
    return Promise.all([mutateActiveTasks(), mutateInactiveTasks()])
  }, [mutateActiveTasks, mutateInactiveTasks])

  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskFields, setNewTaskFields] = useState({
    title: '',
    description: '',
    dueDate: '',
    startAt: '',
    tagIds: [] as string[]
  })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [focusedTaskIndex, setFocusedTaskIndex] = useState<number>(-1)
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: 'title' | 'description' | 'startAt' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingTagsTaskId, setEditingTagsTaskId] = useState<string | null>(null)

  const [currentTime, setCurrentTime] = useState(Date.now())
  const taskIds = useMemo(() => allTasks.map((task) => task.id), [allTasks])

  const shouldFetchTimer = useMemo(() => taskIds.length > 0, [taskIds])
  const {
    data: timersResponse,
    error: timersError,
    isLoading: timersLoading,
    mutate: mutateTimers
  } = useGetApiTimers(taskIds.length ? { taskIds } : undefined, {
    swr: { enabled: shouldFetchTimer }
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

  // Combined list for keyboard navigation (active tasks first, then inactive)
  const allTasksForNavigation = useMemo(() => {
    return [...activeTasks, ...inactiveTasks]
  }, [activeTasks, inactiveTasks])

  // Get the focused task
  const focusedTask = useMemo(() => {
    if (focusedTaskIndex >= 0 && focusedTaskIndex < allTasksForNavigation.length) {
      return allTasksForNavigation[focusedTaskIndex]
    }
    return null
  }, [focusedTaskIndex, allTasksForNavigation])

  // Update current time every minute for timer display
  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(Date.now())

    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Helper to start adding a new task
  const startAddingTask = useCallback(() => {
    const now = new Date()
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setNewTaskFields((prev) => ({ ...prev, startAt: localDateTime, tagIds: filterTagIds }))
    setIsAddingTask(true)
  }, [filterTagIds])

  // Helper to toggle timer for a task
  const toggleTaskTimer = useCallback((task: Task) => {
    const activeTimer = activeTimersByTaskId.get(task.id)
    if (activeTimer) {
      // Stop the timer - move task from active to inactive list optimistically
      setCurrentTime(Date.now())
      window.api.closeFloatingTaskWindow(task.id)

      // Optimistic update: move task from active to inactive list
      mutateActiveTasks(
        (currentData) => {
          if (!currentData) return currentData
          return {
            ...currentData,
            tasks: currentData.tasks.filter((t) => t.id !== task.id),
            total: currentData.total - 1
          }
        },
        { revalidate: false }
      )
      mutateInactiveTasks(
        (currentData) => {
          if (!currentData) return currentData
          return {
            ...currentData,
            tasks: [task, ...currentData.tasks],
            total: currentData.total + 1
          }
        },
        { revalidate: false }
      )

      putApiTimersId(activeTimer.id, {
        endTime: new Date().toISOString()
      })
        .then(() => {
          mutateTimers()
          mutateBothTaskLists()
        })
        .catch((error) => {
          console.error('Failed to stop timer:', error)
          mutateBothTaskLists() // Revert on error
        })
    } else {
      // Start the timer - move task from inactive to active list optimistically
      setCurrentTime(Date.now())
      window.api.openFloatingTaskWindow({ taskId: task.id, title: task.title })

      // Optimistic update: move task from inactive to active list
      mutateInactiveTasks(
        (currentData) => {
          if (!currentData) return currentData
          return {
            ...currentData,
            tasks: currentData.tasks.filter((t) => t.id !== task.id),
            total: currentData.total - 1
          }
        },
        { revalidate: false }
      )
      mutateActiveTasks(
        (currentData) => {
          if (!currentData) return currentData
          return {
            ...currentData,
            tasks: [task, ...currentData.tasks],
            total: currentData.total + 1
          }
        },
        { revalidate: false }
      )

      postApiTimers({
        taskId: task.id,
        startTime: new Date().toISOString()
      })
        .then(() => {
          mutateTimers()
          mutateBothTaskLists()
        })
        .catch((error) => {
          console.error('Failed to start timer:', error)
          mutateBothTaskLists() // Revert on error
        })
    }
  }, [activeTimersByTaskId, mutateTimers, mutateActiveTasks, mutateInactiveTasks, mutateBothTaskLists])

  // Handle keyboard timer toggle
  const handleKeyboardToggleTimer = useCallback(() => {
    // If a task is focused, toggle its timer
    if (focusedTask) {
      toggleTaskTimer(focusedTask)
      return
    }
    // Otherwise, use the oldest task by start time (first inactive task)
    if (inactiveTasks.length > 0) {
      setFocusedTaskIndex(activeTasks.length) // Focus the first inactive task
      toggleTaskTimer(inactiveTasks[0])
    }
  }, [focusedTask, inactiveTasks, activeTasks.length, toggleTaskTimer])

  // Navigate to next task
  const handleNavigateNext = useCallback(() => {
    if (allTasksForNavigation.length === 0) return
    setFocusedTaskIndex((prev) => {
      if (prev < 0) return 0
      return (prev + 1) % allTasksForNavigation.length
    })
  }, [allTasksForNavigation.length])

  // Navigate to previous task
  const handleNavigatePrev = useCallback(() => {
    if (allTasksForNavigation.length === 0) return
    setFocusedTaskIndex((prev) => {
      if (prev < 0) return allTasksForNavigation.length - 1
      return (prev - 1 + allTasksForNavigation.length) % allTasksForNavigation.length
    })
  }, [allTasksForNavigation.length])

  function handleCreateTask(): void {
    if (!newTaskFields.title.trim()) return

    const now = new Date().toISOString()
    const tempId = `temp-${Date.now()}`

    // Create optimistic task object
    const optimisticTask: Task = {
      id: tempId,
      title: newTaskFields.title.trim(),
      description: newTaskFields.description.trim(),
      dueDate: normalizeDueDate(newTaskFields.dueDate) ?? null,
      startAt: normalizeDateTime(newTaskFields.startAt) ?? null,
      completedAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now
    }

    // Optimistic UI: insert task into inactive list (new tasks don't have active timers)
    mutateInactiveTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: [optimisticTask, ...currentData.tasks],
          total: currentData.total + 1
        }
      },
      { revalidate: false }
    )

    // Close form immediately
    setNewTaskFields({ title: '', description: '', dueDate: '', startAt: '', tagIds: [] })
    setIsAddingTask(false)

    // API call in background
    postApiTasks({
      title: optimisticTask.title,
      description: optimisticTask.description,
      dueDate: normalizeDueDate(newTaskFields.dueDate),
      startAt: normalizeDateTime(newTaskFields.startAt),
      tagIds: newTaskFields.tagIds.length > 0 ? newTaskFields.tagIds : undefined
    })
      .then((response) => {
        // Replace optimistic task with real task from server (no full revalidation)
        mutateInactiveTasks(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              tasks: currentData.tasks.map((t) =>
                t.id === tempId ? response.task : t
              )
            }
          },
          { revalidate: false }
        )
      })
      .catch((error) => {
        console.error('Failed to create task:', error)
        // Remove optimistic task on error (no full revalidation)
        mutateInactiveTasks(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              tasks: currentData.tasks.filter((t) => t.id !== tempId),
              total: currentData.total - 1
            }
          },
          { revalidate: false }
        )
      })
  }

  function handleCancelAdd(): void {
    setNewTaskFields({ title: '', description: '', dueDate: '', startAt: '', tagIds: [] })
    setIsAddingTask(false)
  }

  function handleOpenFloatingWindow(taskId: string): void {
    const task = allTasks.find(t => t.id === taskId)
    window.api.openFloatingTaskWindow({ taskId, title: task?.title })
  }

  function handleStartEditing(taskId: string, field: 'title' | 'description' | 'startAt', currentValue: string): void {
    setEditingCell({ taskId, field })
    setEditingValue(currentValue || '')
  }

  function handleCancelEditing(): void {
    setEditingCell(null)
    setEditingValue('')
  }

  function handleSaveEdit(): void {
    if (!editingCell) return

    const task = allTasks.find(t => t.id === editingCell.taskId)
    if (!task) return

    let updateValue: string | null | undefined
    if (editingCell.field === 'startAt') {
      updateValue = normalizeDateTime(editingValue)
    } else {
      updateValue = editingValue.trim()
    }

    const fieldToUpdate = editingCell.field
    const taskIdToUpdate = editingCell.taskId

    // Close edit mode immediately (optimistic UI)
    setEditingCell(null)
    setEditingValue('')

    // Make API call in background
    putApiTasksId(taskIdToUpdate, {
      [fieldToUpdate]: updateValue
    })
      .then(() => mutateBothTaskLists())
      .catch((error) => {
        console.error('Failed to update task:', error)
        // Could show a toast notification here to inform user of failure
      })
  }

  const handleCalendarMoveTask = async (
    task: Task,
    range: { startAt: string; endAt: string }
  ): Promise<void> => {
    try {
      await putApiTasksId(task.id, {
        startAt: normalizeDateTime(range.startAt),
        endAt: normalizeDateTime(range.endAt)
      })
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to update task time range:', error)
    }
  }

  const handleCalendarCreate = async (): Promise<void> => {
    if (!calendarDraft || !calendarDraft.title.trim()) return
    setIsCreatingCalendarTask(true)
    const payload = {
      title: calendarDraft.title.trim(),
      description: calendarDraft.description.trim() || undefined,
      startAt: normalizeDateTime(calendarDraft.startAt),
      endAt: normalizeDateTime(calendarDraft.endAt),
      tagIds: calendarDraft.tagIds.length > 0 ? calendarDraft.tagIds : undefined
    }

    try {
      await postApiTasks(payload)
      setCalendarDraft(null)
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsCreatingCalendarTask(false)
    }
  }

  function handleUpdateTaskTags(taskId: string, tagIds: string[]): void {
    putApiTasksId(taskId, { tagIds })
      .then(() => mutateBothTaskLists())
      .catch((error) => {
        console.error('Failed to update task tags:', error)
      })
  }

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await deleteApiTasksId(taskId)
      if (selectedTask?.id === taskId) {
        setSelectedTask(null)
      }
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  function handleStartTimer(taskId: string): void {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    // UI first (optimistic) - move task from inactive to active
    setCurrentTime(Date.now())
    window.api.openFloatingTaskWindow({ taskId, title: task?.title })

    // Optimistic update: move task from inactive to active list
    mutateInactiveTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: currentData.tasks.filter((t) => t.id !== taskId),
          total: currentData.total - 1
        }
      },
      { revalidate: false }
    )
    mutateActiveTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: [task, ...currentData.tasks],
          total: currentData.total + 1
        }
      },
      { revalidate: false }
    )

    // API call in background
    postApiTimers({
      taskId,
      startTime: new Date().toISOString()
    })
      .then(() => {
        mutateTimers()
        mutateBothTaskLists()
      })
      .catch((error) => {
        console.error('Failed to start timer:', error)
        mutateBothTaskLists() // Revert on error
      })
  }

  function handleStopTimer(taskId: string, timerId: string): void {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    // UI first (optimistic) - move task from active to inactive
    setCurrentTime(Date.now())
    window.api.closeFloatingTaskWindow(taskId)

    // Optimistic update: move task from active to inactive list
    mutateActiveTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: currentData.tasks.filter((t) => t.id !== taskId),
          total: currentData.total - 1
        }
      },
      { revalidate: false }
    )
    mutateInactiveTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: [task, ...currentData.tasks],
          total: currentData.total + 1
        }
      },
      { revalidate: false }
    )

    // API call in background
    putApiTimersId(timerId, {
      endTime: new Date().toISOString()
    })
      .then(() => {
        mutateTimers()
        mutateBothTaskLists()
      })
      .catch((error) => {
        console.error('Failed to stop timer:', error)
        mutateBothTaskLists() // Revert on error
      })
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

  function handleToggleTaskCompletion(task: Task): void {
    const newCompletedAt = task.completedAt ? null : new Date().toISOString()
    const isInActiveList = activeTasks.some(t => t.id === task.id)

    // Determine which mutator to use based on which list the task is in
    const mutateTargetList = isInActiveList ? mutateActiveTasks : mutateInactiveTasks

    // Optimistic UI: update local cache immediately
    mutateTargetList(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: currentData.tasks.map((t) =>
            t.id === task.id ? { ...t, completedAt: newCompletedAt } : t
          )
        }
      },
      { revalidate: false } // Don't revalidate yet
    )

    // API call in background
    putApiTasksId(task.id, { completedAt: newCompletedAt })
      .then(() => mutateBothTaskLists()) // Revalidate after success
      .catch((error) => {
        console.error('Failed to update task completion:', error)
        mutateBothTaskLists() // Revalidate to revert on error
      })
  }

  function renderTaskRow(task: Task): React.JSX.Element {
    const isCompleted = !!task.completedAt
    const isFocused = focusedTask?.id === task.id
    return (
      <TableRow
        key={task.id}
        className={`cursor-pointer hover:bg-muted/50 transition-colors ${isTaskActive(task.id) ? 'bg-primary/5' : ''} ${isCompleted ? 'opacity-50' : ''} ${isFocused ? 'ring-2 ring-primary ring-inset' : ''}`}
        onClick={() => {
          setSelectedTask(task)
          setEditingTagsTaskId(null)
          const index = allTasksForNavigation.findIndex((t) => t.id === task.id)
          setFocusedTaskIndex(index)
        }}
      >
        <TableCell onClick={(e) => { e.stopPropagation(); setEditingTagsTaskId(null) }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenFloatingWindow(task.id)}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Open floating window"
            >
              <Clock4 className="h-4 w-4" />
            </button>
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
        <TableCell
          onClick={(e) => {
            e.stopPropagation()
            setEditingTagsTaskId(null)
            handleStartEditing(task.id, 'startAt', formatDateTimeInput(task.startAt))
          }}
        >
          {editingCell?.taskId === task.id && editingCell?.field === 'startAt' ? (
            <Input
              type="datetime-local"
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
            <span className="cursor-text hover:underline">
              {task.startAt ? formatDateTime(task.startAt) : 'No start time'}
            </span>
          )}
        </TableCell>
        <TableCell
          className="font-medium"
          onClick={(e) => {
            e.stopPropagation()
            setEditingTagsTaskId(null)
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
            <span className={`cursor-text hover:underline ${isCompleted ? 'line-through' : ''}`}>{task.title}</span>
          )}
        </TableCell>
        <TableCell
          className="max-w-xs"
          onClick={(e) => {
            e.stopPropagation()
            setEditingTagsTaskId(null)
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
        <TableCell
          onClick={(e) => {
            e.stopPropagation()
            setEditingTagsTaskId(task.id)
          }}
        >
          {editingTagsTaskId === task.id ? (
            <TagCombobox
              selectedTagIds={task.tags?.map((t) => t.id) ?? []}
              onSelectionChange={(tagIds) => handleUpdateTaskTags(task.id, tagIds)}
              onClose={() => setEditingTagsTaskId(null)}
              placeholder="Add tags..."
              className="min-w-[150px]"
            />
          ) : (
            <div className="flex flex-wrap gap-1 cursor-pointer hover:bg-muted/50 rounded p-1 min-h-[28px]">
              {task.tags && task.tags.length > 0 ? (
                task.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0">
                    {tag.name}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </div>
          )}
        </TableCell>
        <TableCell onClick={(e) => { e.stopPropagation(); setEditingTagsTaskId(null) }}>
          <div className="flex items-center gap-2">
            {hasTimers(task.id) && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleToggleTaskCompletion(task)}
                title={task.completedAt ? 'Mark incomplete' : 'Mark complete'}
                className={task.completedAt ? 'opacity-50' : 'hover:bg-green-100'}
              >
                <CheckCircle className={`h-4 w-4 ${task.completedAt ? 'text-gray-400' : 'text-green-600'}`} />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setSelectedTask(task)
                const index = allTasksForNavigation.findIndex((t) => t.id === task.id)
                setFocusedTaskIndex(index)
              }}
              title="Open task details"
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
          <TableHead>Tags</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
    )
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <KeyboardShortcuts
        onNewTask={startAddingTask}
        onToggleTimer={handleKeyboardToggleTimer}
        onNavigateNext={handleNavigateNext}
        onNavigatePrev={handleNavigatePrev}
        isAddingTask={isAddingTask}
        isEditing={!!editingCell}
      />
      <AppSidebar currentView={currentView} onViewChange={setCurrentView} />
      <SidebarInset>
        {currentView === 'settings' ? (
          <SettingsView />
        ) : currentView === 'calendar' ? (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-8">
            <main className="flex min-h-0 flex-1 flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tags:</span>
                    <TagCombobox
                      selectedTagIds={filterTagIds}
                      onSelectionChange={setFilterTagIds}
                      placeholder="All tags"
                      className="w-48"
                    />
                  </div>
                </div>
                {!isAddingTask && currentView !== 'calendar' && (
                  <Button onClick={startAddingTask}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                )}
              </div>

              {tasksLoading && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  Loading tasks...
                </div>
              )}
              {!tasksLoading && tasksError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  Failed to load tasks. {getErrorMessage(tasksError)}
                </div>
              )}
              {!tasksLoading && !tasksError && (
                <CalendarView
                  className="flex-1 min-h-0"
                  tasks={allTasks}
                  onTaskSelect={(task) => {
                    setSelectedTask(task)
                    const index = allTasksForNavigation.findIndex((t) => t.id === task.id)
                    setFocusedTaskIndex(index)
                  }}
                  onTaskEdit={(task) => {
                    setSelectedTask(task)
                    const index = allTasksForNavigation.findIndex((t) => t.id === task.id)
                    setFocusedTaskIndex(index)
                  }}
                  onTaskDelete={(task) => handleDeleteTask(task.id)}
                  onTaskMove={handleCalendarMoveTask}
                  activeTimersByTaskId={activeTimersByTaskId}
                  onTaskStartTimer={handleStartTimer}
                  onTaskStopTimer={handleStopTimer}
                  onCreateRange={({ startAt, endAt }) => {
                    setCalendarDraft({
                      title: '',
                      description: '',
                      startAt,
                      endAt,
                      tagIds: filterTagIds
                    })
                  }}
                />
              )}
            </main>
          </div>
        ) : (
          <div className="p-8">
            <main className="mx-auto max-w-6xl">
              {timersError && shouldFetchTimer && (
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tags:</span>
                    <TagCombobox
                      selectedTagIds={filterTagIds}
                      onSelectionChange={setFilterTagIds}
                      placeholder="All tags"
                      className="w-48"
                    />
                  </div>
                </div>
                {!isAddingTask && (
                  <Button onClick={startAddingTask}>
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
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Loading tasks...
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && activeTasks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                            <TagCombobox
                              selectedTagIds={newTaskFields.tagIds}
                              onSelectionChange={(tagIds) =>
                                setNewTaskFields((prev) => ({ ...prev, tagIds }))
                              }
                              placeholder="Add tags..."
                              className="min-w-[120px]"
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
                      {tasksLoading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Loading tasks...
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && tasksError && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-destructive">
                            Failed to load tasks. {getErrorMessage(tasksError)}
                          </TableCell>
                        </TableRow>
                      )}
                      {!tasksLoading && !tasksError && inactiveTasks.length === 0 && !isAddingTask && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
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

      </SidebarInset>
      <Dialog
        open={Boolean(calendarDraft)}
        onOpenChange={(open) => {
          if (!open && !isCreatingCalendarTask) {
            setCalendarDraft(null)
          }
        }}
      >
        <DialogContent className="max-w-xl w-[95vw]">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold">New task</div>
              {calendarDraft && (
                <div className="text-sm text-muted-foreground">
                  {`${formatDateTime(calendarDraft.startAt)} -> ${formatDateTime(calendarDraft.endAt)}`}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="calendar-start-at">Start time</Label>
                <Input
                  id="calendar-start-at"
                  type="datetime-local"
                  value={calendarDraft ? formatDateTimeInput(calendarDraft.startAt) : ''}
                  onChange={(event) =>
                    setCalendarDraft((prev) =>
                      prev ? { ...prev, startAt: event.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="calendar-end-at">End time</Label>
                <Input
                  id="calendar-end-at"
                  type="datetime-local"
                  value={calendarDraft ? formatDateTimeInput(calendarDraft.endAt) : ''}
                  onChange={(event) =>
                    setCalendarDraft((prev) =>
                      prev ? { ...prev, endAt: event.target.value } : prev
                    )
                  }
                />
              </div>
            </div>
            <Input
              placeholder="Title"
              value={calendarDraft?.title ?? ''}
              onChange={(event) =>
                setCalendarDraft((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
            />
            <Textarea
              placeholder="Description"
              rows={3}
              value={calendarDraft?.description ?? ''}
              onChange={(event) =>
                setCalendarDraft((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev
                )
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <TagCombobox
                selectedTagIds={calendarDraft?.tagIds ?? []}
                onSelectionChange={(tagIds) =>
                  setCalendarDraft((prev) =>
                    prev ? { ...prev, tagIds } : prev
                  )
                }
                placeholder="Add tags"
                className="w-64"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleCalendarCreate}
                disabled={isCreatingCalendarTask || !calendarDraft?.title.trim()}
              >
                {isCreatingCalendarTask ? 'Creating...' : 'Create task'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCalendarDraft(null)}
                disabled={isCreatingCalendarTask}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl w-[95vw] border-none bg-transparent p-0 shadow-none focus-visible:outline-none">
          {selectedTask ? (
            <TaskSideMenu
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onTaskUpdated={async (updated) => {
                setSelectedTask(updated)
                await mutateBothTaskLists()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
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
