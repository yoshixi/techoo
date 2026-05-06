import { useCallback, useEffect, useRef, useState } from 'react'

type TimeoutRef = ReturnType<typeof setTimeout> | null

export interface UseAutoSaveOptions<T> {
  /** The value to auto-save */
  value: T
  /** Function to call when saving */
  onSave: (value: T) => Promise<void> | void
  /** Debounce delay in milliseconds (default: 800) */
  delay?: number
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean
}

export interface UseAutoSaveReturn {
  /** Whether a save is currently pending */
  isPending: boolean
  /** Whether a save is in progress */
  isSaving: boolean
  /** Manually trigger a save */
  save: () => void
  /** Cancel any pending save */
  cancel: () => void
}

/**
 * Hook for auto-saving values with debounce
 * Used for auto-saving task edits
 */
export function useAutoSave<T>({
  value,
  onSave,
  delay = 800,
  enabled = true
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isPending, setIsPending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const timeoutRef = useRef<TimeoutRef>(null)
  const lastValueRef = useRef<T>(value)
  const onSaveRef = useRef(onSave)

  // Keep onSave ref updated
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsPending(false)
  }, [])

  const save = useCallback(async () => {
    cancel()
    setIsSaving(true)
    try {
      await onSaveRef.current(lastValueRef.current)
    } finally {
      setIsSaving(false)
    }
  }, [cancel])

  useEffect(() => {
    if (!enabled) {
      cancel()
      return
    }

    // Don't trigger save for initial value
    if (lastValueRef.current === value) {
      return
    }

    lastValueRef.current = value
    cancel()
    setIsPending(true)

    timeoutRef.current = setTimeout(() => {
      setIsPending(false)
      void save().catch(() => {
        /* Errors reported in customInstance; avoid unhandled rejection */
      })
    }, delay)

    return cancel
  }, [value, delay, enabled, cancel, save])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isPending,
    isSaving,
    save,
    cancel
  }
}
