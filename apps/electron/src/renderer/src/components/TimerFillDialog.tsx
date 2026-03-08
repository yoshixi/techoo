import React, { useState, useMemo } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { formatDateTimeInput } from '../lib/time'
import type { Task, TaskTimer } from '../gen/api'

export type TimerFillMode = 'no-timer' | 'overlong-timer'

interface TimerFillDialogProps {
  task: Task | null
  mode: TimerFillMode
  /** The overlong active timer to correct (only set when mode is 'overlong-timer') */
  activeTimer?: TaskTimer | null
  onConfirm: (taskId: number, startTime: string, endTime: string) => void
  onSkip: (task: Task) => void
  onCancel: () => void
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function TimerFillDialog({ task, mode, activeTimer, onConfirm, onSkip, onCancel }: TimerFillDialogProps): React.JSX.Element | null {
  const defaults = useMemo(() => {
    if (!task) return { start: '', end: '' }

    if (mode === 'overlong-timer' && activeTimer) {
      // Pre-fill with timer's start and task's planned endAt (or now)
      const start = formatDateTimeInput(activeTimer.startTime)
      const end = task.endAt ? formatDateTimeInput(task.endAt) : formatDateTimeInput(new Date().toISOString())
      return { start, end }
    }

    // No timer mode — use task's start/end
    const start = task.startAt ? formatDateTimeInput(task.startAt) : formatDateTimeInput(new Date().toISOString())
    const end = task.endAt ? formatDateTimeInput(task.endAt) : formatDateTimeInput(new Date().toISOString())
    return { start, end }
  }, [task, mode, activeTimer])

  const [startTime, setStartTime] = useState(defaults.start)
  const [endTime, setEndTime] = useState(defaults.end)

  // Reset when task changes
  React.useEffect(() => {
    setStartTime(defaults.start)
    setEndTime(defaults.end)
  }, [defaults])

  const overlongInfo = useMemo(() => {
    if (mode !== 'overlong-timer' || !activeTimer || !task?.startAt || !task?.endAt) return null
    const plannedMs = new Date(task.endAt).getTime() - new Date(task.startAt).getTime()
    const recordedMs = Date.now() - new Date(activeTimer.startTime).getTime()
    return {
      planned: formatDuration(plannedMs),
      recorded: formatDuration(recordedMs)
    }
  }, [mode, activeTimer, task])

  if (!task) return null

  const handleConfirm = (): void => {
    const start = new Date(startTime).toISOString()
    const end = new Date(endTime).toISOString()
    onConfirm(task.id, start, end)
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'overlong-timer' ? 'Adjust Recorded Time' : 'Record Time'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'overlong-timer'
              ? `The running timer (${overlongInfo?.recorded}) is much longer than planned (${overlongInfo?.planned}). Would you like to correct the end time?`
              : 'This task has no timer records. Would you like to log time spent?'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm font-medium truncate">{task.title}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onSkip(task)}>
            {mode === 'overlong-timer' ? 'Keep as-is' : 'Skip'}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {mode === 'overlong-timer' ? 'Fix & Complete' : 'Record & Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
