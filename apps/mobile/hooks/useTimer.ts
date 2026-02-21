import { useCallback, useEffect, useRef, useState } from 'react'

type TimerRef = ReturnType<typeof setInterval> | null

export interface UseTimerOptions {
  /** Start time as ISO string or Date */
  startTime?: string | Date | null
  /** Whether the timer is active (running) */
  isActive?: boolean
  /** Update interval in milliseconds (default: 1000) */
  interval?: number
}

export interface UseTimerReturn {
  /** Elapsed time in seconds */
  elapsedSeconds: number
  /** Formatted elapsed time string (HH:MM:SS or MM:SS) */
  formattedTime: string
  /** Whether the timer is currently running */
  isRunning: boolean
}

/**
 * Hook for managing a real-time timer display
 * Used for showing elapsed time on active task timers
 */
export function useTimer({
  startTime,
  isActive = false,
  interval = 1000
}: UseTimerOptions = {}): UseTimerReturn {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<TimerRef>(null)

  const calculateElapsed = useCallback(() => {
    if (!startTime) return 0
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime
    const now = new Date()
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000))
  }, [startTime])

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (isActive && startTime) {
      // Set initial value
      setElapsedSeconds(calculateElapsed())

      // Start interval
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(calculateElapsed())
      }, interval)
    } else {
      // If not active, just calculate the elapsed time once (for completed timers)
      setElapsedSeconds(calculateElapsed())
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [startTime, isActive, interval, calculateElapsed])

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    isRunning: isActive && !!startTime
  }
}
