import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { TimerManager } from './TimerManager'
import { putApiTasksId, useGetApiTasksId } from '../gen/api'

export const FloatingTaskWindow: React.FC = () => {
  const params = new URLSearchParams(window.location.search)
  const taskId = params.get('taskId')

  const { data: task, mutate } = useGetApiTasksId(taskId ?? '', {
    swr: {
      enabled: !!taskId
    }
  })
  const [isCompleting, setIsCompleting] = useState(false)

  const isCompleted = Boolean(task?.task.completedAt)

  const handleClose = (): void => {
    if (window.api?.closeFloatingTaskWindow && taskId) {
      window.api.closeFloatingTaskWindow(taskId)
      return
    }
    window.close()
  }

  const handleToggleCompletion = async (): Promise<void> => {
    if (!taskId) return
    setIsCompleting(true)
    try {
      await putApiTasksId(taskId, {
        completedAt: isCompleted ? null : new Date().toISOString()
      })
      await mutate()
    } catch (error) {
      console.error('Failed to update completion status:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  if (!taskId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">No task selected.</p>
        <Button size="sm" variant="outline" onClick={handleClose}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background p-4 text-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Running Task
          </p>
          <h1 className="truncate text-lg font-semibold">{task?.task.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isCompleted ? 'outline' : 'default'}
            onClick={handleToggleCompletion}
            disabled={isCompleting || !task}
          >
            {isCompleting ? 'Updating...' : isCompleted ? 'Reopen' : 'Complete'}
          </Button>
          <Button size="icon" variant="ghost" onClick={handleClose} aria-label="Close window">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <TimerManager taskId={taskId} mode="compact" onTimerStopped={handleClose} />
      </div>
    </div>
  )
}
