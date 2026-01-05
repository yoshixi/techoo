import React, { useEffect, useMemo, useState } from 'react'
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
}

export const TimerManager: React.FC<TimerManagerProps> = ({
  taskId,
  mode = 'full',
  onTimerStarted,
  onTimerStopped
}) => {
  const {
    data: timersResponse,
    error: timersError,
    isLoading: timersLoading,
    mutate: mutateTimers
  } = useGetApiTasksTaskIdTimers(taskId)

  const { trigger: createTimer, isMutating: isCreating } = usePostApiTimers()
  const [activeTimer, setActiveTimer] = useState<TaskTimer | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

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
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const calculateDuration = (start: string, end?: string | null): number => {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    return Math.floor((endTime - startTime) / 1000)
  }

  const isCompact = mode === 'compact'

  if (timersLoading) {
    return (
      <div
        className={
          isCompact
            ? 'h-16 animate-pulse rounded-md bg-muted'
            : 'h-20 animate-pulse rounded-md bg-gray-100'
        }
      ></div>
    )
  }

  if (timersError) {
    return (
      <div className={isCompact ? 'text-sm text-destructive' : 'text-red-500 text-sm'}>
        Failed to load timers
      </div>
    )
  }

  if (isCompact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              activeTimer ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
            }`}
          ></span>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {activeTimer ? formatDuration(elapsedTime) : '00:00:00'}
          </span>
        </div>
        <div>
          {activeTimer ? (
            <button
              onClick={handleStopTimer}
              className="w-full rounded-md bg-destructive/15 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/25"
            >
              Stop Timer
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isCreating}
              className="w-full rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              Start Timer
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h5 className="text-sm font-semibold text-gray-700 mb-3">Timers</h5>

      {/* Active Timer Control */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${activeTimer ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
          ></div>
          <span className="font-mono text-xl font-medium text-gray-800">
            {activeTimer ? formatDuration(elapsedTime) : '00:00:00'}
          </span>
        </div>
        <div>
          {activeTimer ? (
            <button
              onClick={handleStopTimer}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium transition-colors"
            >
              Stop Timer
            </button>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isCreating}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm font-medium transition-colors disabled:opacity-50"
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
                className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-100 last:border-0"
              >
                <div className="flex gap-2">
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
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
