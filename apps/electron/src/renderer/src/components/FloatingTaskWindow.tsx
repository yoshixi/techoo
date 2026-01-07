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
    <div className="flex bg-white/90 h-screen flex-col p-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Running Task
          </p>
          <h1 className="truncate text-base font-semibold text-foreground">{task?.task.title}</h1>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleClose}
          aria-label="Close window"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <TimerManager
        taskId={taskId}
        mode="compact"
        onTimerStopped={handleClose}
        isCompleted={isCompleted}
        isCompleting={isCompleting}
        onToggleCompletion={handleToggleCompletion}
      />
    </div>
  )
}
