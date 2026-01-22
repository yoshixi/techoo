import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, MessageSquareText, Pencil, Check, X } from 'lucide-react'
import type { TaskActivityItem, TaskTimer, TaskComment } from '../gen/api'
import { putApiTimersId } from '../gen/api'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { formatDateTimeInput } from '../lib/time'

type TaskActivitiesProps = {
  activities?: TaskActivityItem[]
  isLoading?: boolean
  error?: unknown
  onTimerUpdated?: () => void
}

const isTimerActivity = (activity: TaskActivityItem): activity is { type: 'timer'; data: TaskTimer } =>
  activity.type === 'timer'

const isCommentActivity = (
  activity: TaskActivityItem
): activity is { type: 'comment'; data: TaskComment } => activity.type === 'comment'

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const computeDurationSeconds = (timer: TaskTimer) => {
  const startTime = new Date(timer.startTime).getTime()
  const endTime = timer.endTime ? new Date(timer.endTime).getTime() : Date.now()
  return Math.floor((endTime - startTime) / 1000)
}

const getActivityTimestamp = (activity: TaskActivityItem): number => {
  if (isTimerActivity(activity)) {
    return new Date(activity.data.startTime).getTime()
  }
  if (isCommentActivity(activity)) {
    return new Date(activity.data.createdAt).getTime()
  }
  return 0
}

export const TaskActivities: React.FC<TaskActivitiesProps> = ({ activities, error, isLoading, onTimerUpdated }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const orderedActivities = useMemo(() => {
    if (!activities) return []
    return [...activities].sort(
      (a, b) => getActivityTimestamp(a) - getActivityTimestamp(b)
    )
  }, [activities])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [orderedActivities.length])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Activities
        </h4>
        {orderedActivities?.length ? (
          <span className="text-xs text-muted-foreground">{orderedActivities.length}</span>
        ) : null}
      </div>
      <div
        ref={containerRef}
        className="space-y-2 max-h-64 overflow-y-auto pr-1"
      >
        {isLoading && <p className="text-xs text-muted-foreground">Loading activities...</p>}
        {Boolean(error) && !isLoading && (
          <p className="text-xs text-destructive">Failed to load activities.</p>
        )}
        {!isLoading && !error && orderedActivities?.length === 0 && (
          <p className="text-xs text-muted-foreground">No activities yet.</p>
        )}
        {!isLoading &&
          !error &&
          orderedActivities?.map((activity) => (
            <ActivityRow key={`${activity.type}-${activity.data.id}`} activity={activity} onTimerUpdated={onTimerUpdated} />
          ))}
      </div>
    </div>
  )
}

type ActivityRowProps = {
  activity: TaskActivityItem
  onTimerUpdated?: () => void
}

const ActivityRow: React.FC<ActivityRowProps> = ({ activity, onTimerUpdated }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (isTimerActivity(activity)) {
    const duration = formatDuration(computeDurationSeconds(activity.data))
    const isRunning = !activity.data.endTime

    const handleStartEdit = (): void => {
      setEditStartTime(formatDateTimeInput(activity.data.startTime))
      setEditEndTime(activity.data.endTime ? formatDateTimeInput(activity.data.endTime) : '')
      setIsEditing(true)
    }

    const handleCancelEdit = (): void => {
      setIsEditing(false)
      setEditStartTime('')
      setEditEndTime('')
    }

    const handleSaveEdit = async (): Promise<void> => {
      setIsSaving(true)
      try {
        await putApiTimersId(activity.data.id, {
          startTime: new Date(editStartTime).toISOString(),
          endTime: editEndTime ? new Date(editEndTime).toISOString() : null
        })
        setIsEditing(false)
        onTimerUpdated?.()
      } catch (error) {
        console.error('Failed to update timer:', error)
      } finally {
        setIsSaving(false)
      }
    }

    if (isEditing) {
      return (
        <article className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1 text-primary">
              <Clock3 className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Edit Focus Session</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-12">Start</label>
              <Input
                type="datetime-local"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-12">End</label>
              <Input
                type="datetime-local"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                className="h-8 text-xs flex-1"
                placeholder="Leave empty for running timer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="h-7 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSaving || !editStartTime}
              className="h-7 px-2"
            >
              <Check className="h-3 w-3 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </article>
      )
    }

    return (
      <article className="group flex items-start gap-3 rounded-2xl border border-black/5 bg-white/90 px-3 py-2">
        <div className="mt-1 rounded-full bg-primary/10 p-1 text-primary">
          <Clock3 className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground">Focus session • {duration}</p>
          <p className="text-xs text-muted-foreground">
            {formatTimestamp(activity.data.startTime)}
            {activity.data.endTime ? ` → ${formatTimestamp(activity.data.endTime)}` : ' (running)'}
          </p>
        </div>
        {!isRunning && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
            aria-label="Edit timer"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </article>
    )
  }

  if (isCommentActivity(activity)) {
    return (
      <article className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white/90 px-3 py-2">
        <div className="mt-1 rounded-full bg-muted p-1 text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="whitespace-pre-wrap text-foreground">
            {renderBodyWithLinks(activity.data.body)}
          </p>
          <p className="text-xs text-muted-foreground">{formatTimestamp(activity.data.createdAt)}</p>
        </div>
      </article>
    )
  }

  return null
}

const renderBodyWithLinks = (body: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urlOnlyRegex = /^https?:\/\/[^\s]+$/i
  const segments = body.split(urlRegex)
  return segments.map((segment, idx) => {
    if (urlOnlyRegex.test(segment)) {
      return (
        <a
          key={`link-${idx}`}
          href={segment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {segment}
        </a>
      )
    }
    if (!segment) {
      return null
    }
    return (
      <span key={`text-${idx}`}>
        {segment}
      </span>
    )
  })
}
