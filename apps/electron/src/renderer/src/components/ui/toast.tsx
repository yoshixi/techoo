import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Convenience function for showing error toasts
export function useErrorToast() {
  const { addToast } = useToast()

  return useCallback(
    (error: unknown, title = 'Error') => {
      const description = getErrorMessage(error)
      addToast({ title, description, variant: 'error' })
    },
    [addToast]
  )
}

// Extract error message from various error formats
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Parse HTTP {statusCode}: {json} format from mutator
    const httpMatch = error.message.match(/^HTTP\s+(\d+):\s*(.*)$/i)
    if (httpMatch) {
      const statusCode = parseInt(httpMatch[1], 10)
      const rawMessage = httpMatch[2].trim()

      // Try to parse JSON error response
      if (rawMessage) {
        try {
          const parsed = JSON.parse(rawMessage) as { error?: string; message?: string }
          if (parsed.error) return parsed.error
          if (parsed.message) return parsed.message
        } catch {
          // Not JSON, use raw message
          if (rawMessage) return rawMessage
        }
      }

      // Fallback to status code description
      return getStatusCodeMessage(statusCode)
    }

    // Network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Unable to connect to the server. Please check your internet connection.'
    }

    return error.message
  }

  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: string }).error
    if (message) return message
  }

  return 'An unexpected error occurred. Please try again.'
}

function getStatusCodeMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input.'
    case 401:
      return 'Please sign in to continue.'
    case 403:
      return 'You do not have permission to perform this action.'
    case 404:
      return 'The requested resource was not found.'
    case 409:
      return 'A conflict occurred. Please refresh and try again.'
    case 422:
      return 'The data provided is invalid.'
    case 429:
      return 'Too many requests. Please wait a moment and try again.'
    case 500:
      return 'Server error. Please try again later.'
    case 502:
    case 503:
    case 504:
      return 'The server is temporarily unavailable. Please try again later.'
    default:
      return `Request failed (${statusCode})`
  }
}

let toastId = 0
function generateId(): string {
  return `toast-${++toastId}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId()
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const duration = toast.duration ?? 5000

  useEffect(() => {
    if (duration === Infinity) return

    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, duration, onRemove])

  const Icon = {
    default: Info,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle
  }[toast.variant ?? 'default']

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-full',
        {
          'bg-background/95 border-border': toast.variant === 'default' || !toast.variant,
          'bg-green-50/95 border-green-200 dark:bg-green-950/95 dark:border-green-800':
            toast.variant === 'success',
          'bg-red-50/95 border-red-200 dark:bg-red-950/95 dark:border-red-800':
            toast.variant === 'error',
          'bg-yellow-50/95 border-yellow-200 dark:bg-yellow-950/95 dark:border-yellow-800':
            toast.variant === 'warning'
        }
      )}
    >
      <Icon
        className={cn('h-5 w-5 shrink-0 mt-0.5', {
          'text-muted-foreground': toast.variant === 'default' || !toast.variant,
          'text-green-600 dark:text-green-400': toast.variant === 'success',
          'text-red-600 dark:text-red-400': toast.variant === 'error',
          'text-yellow-600 dark:text-yellow-400': toast.variant === 'warning'
        })}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn('text-sm font-medium', {
            'text-foreground': toast.variant === 'default' || !toast.variant,
            'text-green-900 dark:text-green-100': toast.variant === 'success',
            'text-red-900 dark:text-red-100': toast.variant === 'error',
            'text-yellow-900 dark:text-yellow-100': toast.variant === 'warning'
          })}
        >
          {toast.title}
        </p>
        {toast.description && (
          <p
            className={cn('text-sm mt-1', {
              'text-muted-foreground': toast.variant === 'default' || !toast.variant,
              'text-green-700 dark:text-green-300': toast.variant === 'success',
              'text-red-700 dark:text-red-300': toast.variant === 'error',
              'text-yellow-700 dark:text-yellow-300': toast.variant === 'warning'
            })}
          >
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className={cn(
          'shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2',
          {
            'hover:bg-muted focus:ring-ring': toast.variant === 'default' || !toast.variant,
            'hover:bg-green-100 focus:ring-green-500 dark:hover:bg-green-900':
              toast.variant === 'success',
            'hover:bg-red-100 focus:ring-red-500 dark:hover:bg-red-900': toast.variant === 'error',
            'hover:bg-yellow-100 focus:ring-yellow-500 dark:hover:bg-yellow-900':
              toast.variant === 'warning'
          }
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
