import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from '../gen/api'
import { normalizeDateTime, normalizeDueDate, getTodayRange } from '../lib/time'

type View = 'tasks' | 'calendar' | 'notes' | 'account' | 'settings'

interface TasksDataOptions {
  currentView: View
  showCompleted: boolean
  showTodayOnly: boolean
  showUnscheduled: boolean
  filterTagIds: number[]
  sortBy: 'createdAt' | 'startAt'
}

export interface UseTasksDataReturn {
  // Task lists
  activeTasks: Task[]
  inactiveTasks: Task[]
  displayTasks: Task[]
  allTasks: Task[]
  sidebarActiveTasks: Task[]

  // Review tab data (unfiltered)
  reviewTasks: Task[]
  reviewTimers: TaskTimer[]
  reviewTimersByTaskId: Map<number, TaskTimer[]>

  // Loading/error state
  tasksLoading: boolean
  tasksError: unknown
  timersLoading: boolean
  timersError: unknown
  shouldFetchTimer: boolean

  // Timer data
  timers: TaskTimer[]
  activeTimersByTaskId: Map<number, TaskTimer>
  timersByTaskId: Map<number, TaskTimer[]>

  // Current time (refreshed every minute)
  currentTime: number

  // Mutations
  mutateActiveTasks: ReturnType<typeof useGetApiTasks>['mutate']
  mutateInactiveTasks: ReturnType<typeof useGetApiTasks>['mutate']
  mutateBothTaskLists: () => Promise<unknown>
  mutateTimers: ReturnType<typeof useGetApiTimers>['mutate']

  // Task operations
  handleStartTimer: (taskId: number) => void
  handleStopTimer: (taskId: number, timerId: number) => void
  toggleTaskTimer: (task: Task) => void
  handleCreateTask: (fields: {
    title: string
    description: string
    dueDate: string
    startAt: string
    tagIds: number[]
  }) => void
  handleCreateTaskAndStartTimer: (title: string, tagIds?: number[]) => void
  handleDeleteTask: (taskId: number) => Promise<void>
  handleToggleTaskCompletion: (task: Task) => void
  handleUpdateTaskTags: (taskId: number, tagIds: number[]) => void
  handleSaveSchedule: (taskId: number, startAt: string | null, endAt: string | null) => Promise<void>
  handleSaveEdit: (taskId: number, field: 'title' | 'description', value: string) => void
  isTaskActive: (taskId: number) => boolean

  // Expanded timer rows
  expandedTaskIds: Set<number>
  toggleTaskExpansion: (taskId: number) => void
}

export function useTasksData(options: TasksDataOptions): UseTasksDataReturn {
  const { currentView, showCompleted, showTodayOnly, showUnscheduled, filterTagIds, sortBy } = options

  const [currentTime, setCurrentTime] = useState(Date.now())
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())

  const todayRange = useMemo(() => getTodayRange(), [currentTime])

  // Update current time every minute
  useEffect(() => {
    setCurrentTime(Date.now())
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Query for tasks with active timers (filtered by current view settings)
  const activeTaskQuery = useMemo(() => {
    if (currentView === 'calendar') {
      return {
        completed: undefined,
        hasActiveTimer: 'true' as const,
        scheduled: undefined,
        startAtFrom: undefined,
        startAtTo: undefined,
        sortBy,
        order: 'asc' as const,
        tags: filterTagIds.length ? filterTagIds : undefined
      }
    }

    const scheduledFilter = showUnscheduled
      ? (showTodayOnly ? ('false' as const) : undefined)
      : ('true' as const)

    return {
      completed: showCompleted ? undefined : ('false' as const),
      hasActiveTimer: 'true' as const,
      scheduled: scheduledFilter,
      startAtFrom: showTodayOnly ? todayRange.startAt : undefined,
      startAtTo: showTodayOnly ? todayRange.endAt : undefined,
      sortBy,
      order: 'asc' as const,
      nullsLast: showUnscheduled ? ('true' as const) : undefined,
      tags: filterTagIds.length ? filterTagIds : undefined
    }
  }, [showCompleted, showTodayOnly, showUnscheduled, sortBy, filterTagIds, currentView, todayRange])

  const {
    data: activeTasksResponse,
    error: activeTasksError,
    isLoading: activeTasksLoading,
    mutate: mutateActiveTasks
  } = useGetApiTasks(activeTaskQuery)
  const activeTasks = activeTasksResponse?.tasks ?? []

  // Query for ALL tasks with active timers (for sidebar - no filters)
  const sidebarActiveTaskQuery = useMemo(
    () => ({
      hasActiveTimer: 'true' as const,
      sortBy: 'startAt' as const,
      order: 'asc' as const
    }),
    []
  )
  const {
    data: sidebarActiveTasksResponse,
    mutate: mutateSidebarActiveTasks
  } = useGetApiTasks(sidebarActiveTaskQuery)
  const sidebarActiveTasks = sidebarActiveTasksResponse?.tasks ?? []

  // Query for tasks without active timers
  const inactiveTaskQuery = useMemo(() => {
    if (currentView === 'calendar') {
      return {
        completed: undefined,
        hasActiveTimer: 'false' as const,
        scheduled: undefined,
        startAtFrom: undefined,
        startAtTo: undefined,
        sortBy,
        order: 'asc' as const,
        tags: filterTagIds.length ? filterTagIds : undefined
      }
    }

    const scheduledFilter = showUnscheduled
      ? (showTodayOnly ? ('false' as const) : undefined)
      : ('true' as const)

    return {
      completed: showCompleted ? undefined : ('false' as const),
      hasActiveTimer: 'false' as const,
      scheduled: scheduledFilter,
      startAtFrom: showTodayOnly ? todayRange.startAt : undefined,
      startAtTo: showTodayOnly ? todayRange.endAt : undefined,
      sortBy,
      order: 'asc' as const,
      nullsLast: showUnscheduled ? ('true' as const) : undefined,
      tags: filterTagIds.length ? filterTagIds : undefined
    }
  }, [showCompleted, showTodayOnly, showUnscheduled, sortBy, filterTagIds, currentView, todayRange])

  const {
    data: inactiveTasksResponse,
    error: inactiveTasksError,
    isLoading: inactiveTasksLoading,
    mutate: mutateInactiveTasks
  } = useGetApiTasks(inactiveTaskQuery)
  const inactiveTasks = inactiveTasksResponse?.tasks ?? []

  const displayTasks = useMemo(() => [...activeTasks, ...inactiveTasks], [activeTasks, inactiveTasks])

  const allTasks = useMemo(() => {
    const taskMap = new Map<number, Task>()
    for (const task of [...activeTasks, ...inactiveTasks, ...sidebarActiveTasks]) {
      taskMap.set(task.id, task)
    }
    return Array.from(taskMap.values())
  }, [activeTasks, inactiveTasks, sidebarActiveTasks])

  const tasksLoading = activeTasksLoading || inactiveTasksLoading
  const tasksError = activeTasksError || inactiveTasksError

  // Review tab: fetch tasks from the last 14 days (including completed) for review charts
  const reviewDateRange = useMemo(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)
    return { startAtFrom: from.toISOString() }
  }, [currentTime])
  const reviewTaskQuery = useMemo(
    () => ({
      startAtFrom: reviewDateRange.startAtFrom,
      sortBy: 'startAt' as const,
      order: 'asc' as const
    }),
    [reviewDateRange]
  )
  const {
    data: reviewTasksResponse,
    mutate: mutateReviewTasks
  } = useGetApiTasks(reviewTaskQuery)
  const reviewTasks = reviewTasksResponse?.tasks ?? []

  const mutateBothTaskLists = useCallback(() => {
    return Promise.all([mutateActiveTasks(), mutateInactiveTasks(), mutateSidebarActiveTasks(), mutateReviewTasks()])
  }, [mutateActiveTasks, mutateInactiveTasks, mutateSidebarActiveTasks, mutateReviewTasks])

  // Timers — include review task IDs so we get timer data for the Review tab
  const taskIds = useMemo(() => {
    const idSet = new Set<number>()
    for (const task of allTasks) idSet.add(task.id)
    for (const task of reviewTasks) idSet.add(task.id)
    return Array.from(idSet)
  }, [allTasks, reviewTasks])
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
    const map = new Map<number, TaskTimer>()
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

  const timersByTaskId = useMemo(() => {
    const map = new Map<number, TaskTimer[]>()
    timers.forEach((timer) => {
      const existing = map.get(timer.taskId) || []
      map.set(timer.taskId, [...existing, timer])
    })
    map.forEach((taskTimers, taskId) => {
      map.set(
        taskId,
        taskTimers.sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )
      )
    })
    return map
  }, [timers])

  // Review-specific timer grouping (uses all timers, grouped by review task IDs)
  const reviewTimersByTaskId = useMemo(() => {
    const map = new Map<number, TaskTimer[]>()
    const reviewTaskIds = new Set(reviewTasks.map((t) => t.id))
    timers.forEach((timer) => {
      if (!reviewTaskIds.has(timer.taskId)) return
      const existing = map.get(timer.taskId) || []
      map.set(timer.taskId, [...existing, timer])
    })
    return map
  }, [timers, reviewTasks])

  // Sync active timer states to main process
  useEffect(() => {
    const timerStates = Array.from(activeTimersByTaskId.entries()).map(([taskId, timer]) => {
      const task = allTasks.find((t) => t.id === taskId)
      return {
        timerId: timer.id,
        taskId,
        taskTitle: task?.title || 'Task',
        startTime: timer.startTime
      }
    })
    window.api.updateTimerStates(timerStates)
  }, [activeTimersByTaskId, allTasks])

  // Cleanup timer states on unmount
  useEffect(() => {
    return () => {
      window.api.updateTimerStates([])
    }
  }, [])

  // Listen for timer events from system notifications
  useEffect(() => {
    const unsubscribeStart = window.api.onNotificationTimerStarted(() => {
      mutateBothTaskLists()
      mutateTimers()
    })
    const unsubscribeStop = window.api.onNotificationTimerStopped(() => {
      mutateBothTaskLists()
      mutateTimers()
    })
    return () => {
      unsubscribeStart()
      unsubscribeStop()
    }
  }, [mutateBothTaskLists, mutateTimers])

  const toggleTaskExpansion = useCallback((taskId: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])

  // --- Mutation operations ---

  const handleStartTimer = useCallback((taskId: number) => {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    setCurrentTime(Date.now())
    setExpandedTaskIds((prev) => new Set(prev).add(taskId))

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

    postApiTimers({ taskId, startTime: new Date().toISOString() })
      .then(() => { mutateTimers(); mutateBothTaskLists() })
      .catch((error) => { console.error('Failed to start timer:', error); mutateBothTaskLists() })
  }, [allTasks, mutateTimers, mutateActiveTasks, mutateInactiveTasks, mutateBothTaskLists])

  const handleStopTimer = useCallback((taskId: number, timerId: number) => {
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    setCurrentTime(Date.now())

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

    putApiTimersId(timerId, { endTime: new Date().toISOString() })
      .then(() => { mutateTimers(); mutateBothTaskLists() })
      .catch((error) => { console.error('Failed to stop timer:', error); mutateBothTaskLists() })
  }, [allTasks, mutateTimers, mutateActiveTasks, mutateInactiveTasks, mutateBothTaskLists])

  const toggleTaskTimer = useCallback((task: Task) => {
    const activeTimer = activeTimersByTaskId.get(task.id)
    if (activeTimer) {
      handleStopTimer(task.id, activeTimer.id)
    } else {
      handleStartTimer(task.id)
    }
  }, [activeTimersByTaskId, handleStartTimer, handleStopTimer])

  const handleCreateTask = useCallback((fields: {
    title: string
    description: string
    dueDate: string
    startAt: string
    tagIds: number[]
  }) => {
    if (!fields.title.trim()) return

    const now = new Date().toISOString()
    const tempId = -Date.now()

    const optimisticTask: Task = {
      id: tempId,
      title: fields.title.trim(),
      description: fields.description.trim(),
      dueDate: normalizeDueDate(fields.dueDate) ?? null,
      startAt: normalizeDateTime(fields.startAt) ?? null,
      completedAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now
    }

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

    postApiTasks({
      title: optimisticTask.title,
      description: optimisticTask.description,
      dueDate: normalizeDueDate(fields.dueDate),
      startAt: normalizeDateTime(fields.startAt),
      tagIds: fields.tagIds.length > 0 ? fields.tagIds : undefined
    })
      .then((response) => {
        mutateInactiveTasks(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              tasks: currentData.tasks.map((t) => t.id === tempId ? response.task : t)
            }
          },
          { revalidate: false }
        )
      })
      .catch((error) => {
        console.error('Failed to create task:', error)
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
  }, [mutateInactiveTasks])

  const handleCreateTaskAndStartTimer = useCallback((title: string, tagIds?: number[]) => {
    if (!title.trim()) return

    const now = new Date().toISOString()
    const tempId = -Date.now()

    const optimisticTask: Task = {
      id: tempId,
      title: title.trim(),
      description: '',
      dueDate: null,
      startAt: now,
      completedAt: null,
      tags: [],
      createdAt: now,
      updatedAt: now
    }

    // Optimistically add to active tasks (it will have a timer)
    mutateActiveTasks(
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

    postApiTasks({
      title: title.trim(),
      startAt: now,
      tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined
    })
      .then((response) => {
        // Replace optimistic task with real one
        mutateActiveTasks(
          (currentData) => {
            if (!currentData) return currentData
            return {
              ...currentData,
              tasks: currentData.tasks.map((t) => t.id === tempId ? response.task : t)
            }
          },
          { revalidate: false }
        )
        // Start timer for the new task
        return postApiTimers({ taskId: response.task.id, startTime: new Date().toISOString() })
      })
      .then(() => {
        mutateTimers()
        mutateBothTaskLists()
      })
      .catch((error) => {
        console.error('Failed to create task and start timer:', error)
        mutateActiveTasks(
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
        mutateBothTaskLists()
      })
  }, [mutateActiveTasks, mutateTimers, mutateBothTaskLists])

  const handleDeleteTask = useCallback(async (taskId: number): Promise<void> => {
    if (!confirm('Are you sure you want to delete this task?')) return
    try {
      await deleteApiTasksId(taskId)
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }, [mutateBothTaskLists])

  const handleToggleTaskCompletion = useCallback((task: Task) => {
    const newCompletedAt = task.completedAt ? null : new Date().toISOString()
    const isInActiveList = activeTasks.some(t => t.id === task.id)
    const mutateTargetList = isInActiveList ? mutateActiveTasks : mutateInactiveTasks

    mutateTargetList(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: currentData.tasks.filter((t) => t.id !== task.id)
        }
      },
      { revalidate: false }
    )
    mutateReviewTasks(
      (currentData) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          tasks: currentData.tasks.map((t) =>
            t.id === task.id ? { ...t, completedAt: newCompletedAt } : t
          )
        }
      },
      { revalidate: false }
    )

    putApiTasksId(task.id, { completedAt: newCompletedAt })
      .then(() => mutateBothTaskLists())
      .catch((error) => { console.error('Failed to update task completion:', error); mutateBothTaskLists() })
  }, [activeTasks, mutateActiveTasks, mutateInactiveTasks, mutateReviewTasks, mutateBothTaskLists])

  const handleUpdateTaskTags = useCallback((taskId: number, tagIds: number[]) => {
    putApiTasksId(taskId, { tagIds })
      .then(() => mutateBothTaskLists())
      .catch((error) => console.error('Failed to update task tags:', error))
  }, [mutateBothTaskLists])

  const handleSaveSchedule = useCallback(async (taskId: number, startAt: string | null, endAt: string | null): Promise<void> => {
    try {
      await putApiTasksId(taskId, {
        startAt: startAt ? normalizeDateTime(startAt) : null,
        endAt: endAt ? normalizeDateTime(endAt) : null
      })
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to update schedule:', error)
    }
  }, [mutateBothTaskLists])

  const handleSaveEdit = useCallback((taskId: number, field: 'title' | 'description', value: string) => {
    putApiTasksId(taskId, { [field]: value.trim() })
      .then(() => mutateBothTaskLists())
      .catch((error) => console.error('Failed to update task:', error))
  }, [mutateBothTaskLists])

  const isTaskActive = useCallback((taskId: number): boolean => {
    return activeTimersByTaskId.has(taskId)
  }, [activeTimersByTaskId])

  return {
    activeTasks,
    inactiveTasks,
    displayTasks,
    allTasks,
    sidebarActiveTasks,
    reviewTasks,
    reviewTimers: timers,
    reviewTimersByTaskId,
    tasksLoading,
    tasksError,
    timersLoading,
    timersError,
    shouldFetchTimer,
    timers,
    activeTimersByTaskId,
    timersByTaskId,
    currentTime,
    mutateActiveTasks,
    mutateInactiveTasks,
    mutateBothTaskLists,
    mutateTimers,
    handleStartTimer,
    handleStopTimer,
    toggleTaskTimer,
    handleCreateTask,
    handleCreateTaskAndStartTimer,
    handleDeleteTask,
    handleToggleTaskCompletion,
    handleUpdateTaskTags,
    handleSaveSchedule,
    handleSaveEdit,
    isTaskActive,
    expandedTaskIds,
    toggleTaskExpansion
  }
}
