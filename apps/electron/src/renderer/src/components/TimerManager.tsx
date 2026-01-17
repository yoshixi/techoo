import React, { useEffect, useMemo, useState } from 'react'
import { Square, CheckCircle, Play, Pencil, Check, X } from 'lucide-react'
import {
  useGetApiTasksTaskIdTimers,
  usePostApiTimers,
  putApiTimersId,
  type TaskTimer
} from '../gen/api'

interface TimerManagerProps {
  taskId: string
  mode?: 'full' | 'compact'
  onTimerStarted?: () => void
  onTimerStopped?: () => void
  onActivityRecorded?: () => void
  isCompleted?: boolean
  isCompleting?: boolean
  onToggleCompletion?: () => void
}

export const TimerManager: React.FC<TimerManagerProps> = ({
  taskId,
  mode = 'full',
  onTimerStarted,
  onTimerStopped,
  onActivityRecorded,
  isCompleted,
  isCompleting,
  onToggleCompletion
}) => {
  const {
    data: timersResponse,
    error: timersError,
    mutate: mutateTimers
  } = useGetApiTasksTaskIdTimers(taskId)

  const { trigger: createTimer, isMutating: isCreating } = usePostApiTimers()
  const [activeTimer, setActiveTimer] = useState<TaskTimer | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
  const [editingStartTime, setEditingStartTime] = useState<string>('')
  const [editingEndTime, setEditingEndTime] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const timers = useMemo(() => timersResponse?.timers ?? [], [timersResponse?.timers])

  // Find active timer on load or update
  useEffect(() => {
    if (timers) {
      const active = timers.find((timer) => !timer.endTime)
      setActiveTimer(active || null)
    }
  }, [timers])

  // Update active timer elapsed time
  useEffect(() => {
    if (!activeTimer) {
      setElapsedTime(0)
      return
    }

    const start = new Date(activeTimer.startTime).getTime()

    // Initial update
    setElapsedTime(Math.floor((Date.now() - start) / 1000))

    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedTime(Math.floor((now - start) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [activeTimer])

  const handleStartTimer = async (): Promise<void> => {
    try {
      await createTimer({
        taskId,
        startTime: new Date().toISOString()
      })
      mutateTimers()
      onTimerStarted?.()
      onActivityRecorded?.()
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStopTimer = async (): Promise<void> => {
    if (!activeTimer) return

    try {
      await putApiTimersId(activeTimer.id, {
        endTime: new Date().toISOString()
      })
      mutateTimers()
      onTimerStopped?.()
      onActivityRecorded?.()
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const formatDatetimeLocal = (isoString: string): string => {
    const date = new Date(isoString)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const handleEditTimer = (timer: TaskTimer): void => {
    setEditingTimerId(timer.id)
    setEditingStartTime(formatDatetimeLocal(timer.startTime))
    setEditingEndTime(timer.endTime ? formatDatetimeLocal(timer.endTime) : '')
  }

  const handleCancelEdit = (): void => {
    setEditingTimerId(null)
    setEditingStartTime('')
    setEditingEndTime('')
  }

  const handleSaveTimer = async (): Promise<void> => {
    if (!editingTimerId || !editingStartTime) return

    setIsUpdating(true)
    try {
      await putApiTimersId(editingTimerId, {
        startTime: new Date(editingStartTime).toISOString(),
        endTime: editingEndTime ? new Date(editingEndTime).toISOString() : null
      })
      mutateTimers()
      setEditingTimerId(null)
      setEditingStartTime('')
      setEditingEndTime('')
    } catch (error) {
      console.error('Failed to update timer:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string, endTime?: string | null): number => {
    const start = new Date(startTime).getTime()
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    if (Number.isNaN(start) || Number.isNaN(end)) return 0
    return Math.max(0, Math.floor((end - start) / 1000))
  }

  const isCompact = mode === 'compact'

  // Show interactive UI immediately while loading instead of skeleton
  // This allows the user to see the timer controls right away

  if (timersError) {
    return (
      <div className={isCompact ? 'text-sm text-destructive' : 'text-red-500 text-sm'}>
        Failed to load timers
      </div>
    )
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-muted/40 px-2 py-1 text-xs font-semibold text-foreground">
          <span
            className={`h-2 w-2 rounded-full ${
              activeTimer ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'
            }`}
          ></span>
          <span className="font-mono text-sm">
            {activeTimer ? formatDuration(elapsedTime) : '00:00:00'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {activeTimer ? (
            <button
              onClick={handleStopTimer}
              className="rounded-full border border-destructive/30 bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/20"
              aria-label="Stop Timer"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isCreating}
              className="rounded-full border border-primary/40 bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              aria-label="Start Timer"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleCompletion && (
            <button
              onClick={onToggleCompletion}
              disabled={isCompleting}
              className={`rounded-full border p-2 transition-colors ${
                isCompleted
                  ? 'border-green-500/40 bg-green-500/10 text-green-700'
                  : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground/40'
              } disabled:opacity-50`}
              aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Timers
      </h5>

      {/* Active Timer Control */}
      <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/90 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${activeTimer ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
          ></div>
          <span className="font-mono text-xl font-medium text-gray-800">
            {activeTimer ? formatDuration(elapsedTime) : '00:00:00'}
          </span>
        </div>
        <div className="flex gap-2 text-muted-foreground">
          {activeTimer ? (
            <button
              onClick={handleStopTimer}
              className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-500/15"
            >
              Stop Timer
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isCreating}
              className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              Start Timer
            </button>
          )}
        </div>
      </div>

      {/* Timer History */}
      {timers.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {timers
            .slice()
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .map((timer) => (
              <div
                key={timer.id}
                className="flex justify-between items-center text-xs text-gray-500 py-1 border-b border-gray-100 last:border-0"
              >
                {editingTimerId === timer.id ? (
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Start:</span>
                      <input
                        type="datetime-local"
                        value={editingStartTime}
                        onChange={(e) => setEditingStartTime(e.target.value)}
                        className="text-xs border rounded px-1 py-0.5 text-gray-700"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">End:</span>
                      <input
                        type="datetime-local"
                        value={editingEndTime}
                        onChange={(e) => setEditingEndTime(e.target.value)}
                        className="text-xs border rounded px-1 py-0.5 text-gray-700"
                        placeholder="Active"
                      />
                    </div>
                    <button
                      onClick={handleSaveTimer}
                      disabled={isUpdating}
                      className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                      aria-label="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                      aria-label="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTimer(timer)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        aria-label="Edit timer"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <span>{new Date(timer.startTime).toLocaleDateString()}</span>
                      <span>
                        {new Date(timer.startTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span>-</span>
                      <span>
                        {timer.endTime
                          ? new Date(timer.endTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Now'}
                      </span>
                    </div>
                    <div className="font-mono">
                      {formatDuration(calculateDuration(timer.startTime, timer.endTime))}
                    </div>
                  </>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
