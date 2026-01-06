import React, { useEffect, useMemo, useState } from 'react'
import {
  deleteApiTasksId,
  putApiTasksId,
  putApiTimersId,
  useGetApiTasks,
  useGetApiTimers,
  usePostApiTasks,
  usePostApiTimers,
  type Task,
  type TaskTimer
} from '../gen/api'
import { TaskSideMenu } from './TaskSideMenu'

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

/**
 * Task Management Component
 * Demonstrates full CRUD operations with SWR hooks
 */
export const TaskManager: React.FC = () => {
  const [now, setNow] = useState(Date.now())
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: ''
  })

  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Fetch all tasks
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks
  } = useGetApiTasks()

  const tasks = tasksResponse?.tasks ?? []
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks])

  const {
    data: timersResponse,
    error: timersError,
    isLoading: timersLoading,
    mutate: mutateTimers
  } = useGetApiTimers(taskIds.length ? { taskIds } : undefined, {
    swr: { enabled: taskIds.length > 0 }
  })

  const { trigger: createTimer } = usePostApiTimers()
  const { trigger: createTask, isMutating: isCreating } = usePostApiTasks()

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

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateTask = async (): Promise<void> => {
    if (!newTask.title?.trim()) return

    try {
      await createTask({
        title: newTask.title.trim(),
        description: newTask.description?.trim() || undefined,
        dueDate: normalizeDueDate(newTask.dueDate)
      })
      setNewTask({ title: '', description: '', dueDate: '' })
      mutateTasks() // Refresh the tasks list
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this task?')) return

    setDeletingTaskId(taskId)
    try {
      await deleteApiTasksId(taskId)
      mutateTasks() // Refresh the tasks list
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleStartTimer = async (taskId: string): Promise<void> => {
    try {
      await createTimer({
        taskId,
        startTime: new Date().toISOString()
      })
      await mutateTimers()
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleToggleTaskCompletion = async (task: Task): Promise<void> => {
    setCompletingTaskId(task.id)
    try {
      const response = await putApiTasksId(task.id, {
        completedAt: task.completedAt ? null : new Date().toISOString()
      })
      await mutateTasks()
      setSelectedTask((prev) => (prev?.id === task.id ? response.task : prev))
    } catch (error) {
      console.error('Failed to update task completion:', error)
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleStopTimer = async (timerId: string): Promise<void> => {
    try {
      await putApiTimersId(timerId, {
        endTime: new Date().toISOString()
      })
      await mutateTimers()
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`
  }

  if (tasksLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (tasksError) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <h3 className="text-red-800 font-semibold mb-2">Failed to Load Tasks</h3>
        <p className="text-red-600 text-sm">{getErrorMessage(tasksError)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Task Management</h2>
        <div className="text-sm text-gray-500">{tasks.length} task(s)</div>
      </div>

      {/* Create New Task */}
      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
        <h3 className="text-blue-800 font-semibold mb-3">Create New Task</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Task title..."
            value={newTask.title || ''}
            onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <textarea
            placeholder="Task description..."
            value={newTask.description || ''}
            onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
          <input
            type="date"
            value={newTask.dueDate}
            onChange={(e) => setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreateTask}
            disabled={!newTask.title?.trim() || isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>

      {timersError && (
        <div className="p-4 border rounded-lg bg-red-50 border-red-200">
          <p className="text-red-600 text-sm">Failed to load timers.</p>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 border rounded-lg bg-white shadow-sm transition-shadow cursor-pointer hover:shadow-md ${selectedTask?.id === task.id ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
            onClick={() => setSelectedTask(task)}
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <h4
                  className={`font-semibold ${task.completedAt ? 'text-gray-500 line-through' : 'text-gray-900'}`}
                >
                  {task.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {task.dueDate
                    ? `Due ${new Date(task.dueDate).toLocaleDateString()}`
                    : 'No due date'}
                  {task.completedAt && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      Completed
                    </span>
                  )}
                </div>
              </div>
              {task.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Created: {new Date(task.createdAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleTaskCompletion(task)}
                    disabled={completingTaskId === task.id}
                    className={`px-3 py-1 text-sm rounded ${task.completedAt ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-100 text-green-800 hover:bg-green-200'} disabled:opacity-50`}
                  >
                    {completingTaskId === task.id
                      ? 'Updating...'
                      : task.completedAt
                        ? 'Reopen'
                        : 'Complete'}
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={deletingTaskId === task.id}
                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                <div className="text-sm font-mono text-gray-800">
                  {(() => {
                    const activeTimer = activeTimersByTaskId.get(task.id)
                    if (!activeTimer) return '00:00:00'
                    const elapsedSeconds = Math.floor(
                      (now - new Date(activeTimer.startTime).getTime()) / 1000
                    )
                    return formatDuration(elapsedSeconds)
                  })()}
                </div>
                <div>
                  {(() => {
                    const activeTimer = activeTimersByTaskId.get(task.id)
                    if (activeTimer) {
                      return (
                        <button
                          onClick={() => handleStopTimer(activeTimer.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
                        >
                          Stop
                        </button>
                      )
                    }
                    return (
                      <button
                        onClick={() => handleStartTimer(task.id)}
                        disabled={timersLoading}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                      >
                        Start
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No tasks found. Create your first task above!</p>
          </div>
        )}
      </div>

      {/* Side Menu */}
      <TaskSideMenu
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={(updated) => {
          setSelectedTask(updated)
          mutateTasks()
        }}
        enableEditing
      />
    </div>
  )
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

export default TaskManager
