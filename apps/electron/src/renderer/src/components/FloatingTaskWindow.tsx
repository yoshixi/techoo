import React, { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { TimerManager } from './TimerManager'
import { putApiTasksId, useGetApiTasksId } from '../gen/api'

export const FloatingTaskWindow: React.FC = () => {
  const params = new URLSearchParams(window.location.search)
  const taskId = params.get('taskId')
  const initialTitle = params.get('title')

  const { data: task, isLoading: taskLoading, mutate } = useGetApiTasksId(taskId ?? '', {
    swr: {
      enabled: !!taskId
    }
  })
  const [isCompleting, setIsCompleting] = useState(false)

  const isCompleted = Boolean(task?.task.completedAt)
  // Use title from query params immediately, then switch to API data when loaded
  const taskTitle = task?.task.title ?? initialTitle ?? 'Loading...'

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

  // Show loading only if we don't have any title to display
  if (taskLoading && !initialTitle) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white/90">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex bg-white/90 h-screen flex-col" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3 pt-4 px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Running Task
          </p>
          <h1 className="truncate text-base font-semibold text-foreground">{taskTitle}</h1>
          {task?.task.tags && task.task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {task.task.tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
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

      <div className="px-4 z-10" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <TimerManager
          taskId={taskId}
          mode="compact"
          onTimerStopped={handleClose}
          isCompleted={isCompleted}
          isCompleting={isCompleting}
          onToggleCompletion={handleToggleCompletion}
        />
      </div>
    </div>
  )
}
