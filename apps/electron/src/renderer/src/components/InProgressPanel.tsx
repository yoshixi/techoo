import React, { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Circle, Loader2, Maximize2, SendHorizonal, Square } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { useErrorToast } from './ui/toast'
import { cn } from '../lib/utils'
import type { Task, TaskTimer } from '../gen/api'
import { useTaskComments, createTaskComment, type TaskComment } from '../hooks/useTaskComments'
import { useSidebar } from './ui/sidebar'

interface InProgressPanelProps {
  tasks: Task[]
  activeTimersByTaskId: Map<string, TaskTimer>
  onStopTimer: (taskId: string, timerId: string) => void
  onOpenTaskDetail: (task: Task) => void
}

interface TaskCardProps {
  task: Task
  timer: TaskTimer
  onStopTimer: () => void
  onOpenDetail: () => void
  isCollapsed: boolean
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function formatElapsed(startTime: string): string {
  const start = new Date(startTime).getTime()
  const elapsed = Math.floor((Date.now() - start) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function CommentItem({ comment }: { comment: TaskComment }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs">
      <p className="text-foreground whitespace-pre-wrap break-words">{comment.body}</p>
      <p className="mt-1 text-muted-foreground text-[10px]">{formatRelativeTime(comment.createdAt)}</p>
    </div>
  )
}

function TaskCard({ task, timer, onStopTimer, onOpenDetail, isCollapsed }: TaskCardProps): React.JSX.Element {
  const [elapsed, setElapsed] = useState(() => formatElapsed(timer.startTime))
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)
  const { data: commentsData, mutate: mutateComments } = useTaskComments(task.id)
  const showError = useErrorToast()

  const comments = commentsData?.comments ?? []
  const sortedComments = [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const visibleComments = showAllComments ? sortedComments : sortedComments.slice(0, 3)
  const hasMoreComments = sortedComments.length > 3

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(timer.startTime))
    }, 1000)
    return () => clearInterval(interval)
  }, [timer.startTime])

  const handleSubmitComment = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createTaskComment(task.id, trimmed)
      setDraft('')
      mutateComments()
    } catch (error) {
      showError(error, 'Failed to add comment')
    } finally {
      setIsSubmitting(false)
    }
  }, [draft, isSubmitting, task.id, mutateComments, showError])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleSubmitComment()
      }
    },
    [handleSubmitComment]
  )

  // Collapsed view - just show icon and time
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <div className="relative">
          <Circle className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{elapsed}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header: Task name + Timer */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Circle className="h-2.5 w-2.5 text-red-500 fill-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-medium truncate">{task.title}</span>
        </div>
        <span className="text-sm font-mono text-muted-foreground shrink-0">{elapsed}</span>
      </div>

      {/* Comment Input */}
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What are you working on?"
          rows={2}
          className="text-xs resize-none"
        />
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSubmitComment}
            disabled={!draft.trim() || isSubmitting}
            className="h-7 text-xs"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <SendHorizonal className="h-3 w-3 mr-1" />
                Post
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Comments History */}
      {sortedComments.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Comments ({sortedComments.length})
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {visibleComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
          {hasMoreComments && !showAllComments && (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="text-[10px] text-primary hover:underline"
            >
              Show {sortedComments.length - 3} more comments
            </button>
          )}
          {showAllComments && hasMoreComments && (
            <button
              type="button"
              onClick={() => setShowAllComments(false)}
              className="text-[10px] text-primary hover:underline"
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onStopTimer}
          className="h-7 text-xs flex-1"
        >
          <Square className="h-3 w-3 mr-1 text-red-500" />
          Stop
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenDetail}
          className="h-7 text-xs flex-1"
        >
          <Maximize2 className="h-3 w-3 mr-1" />
          Details
        </Button>
      </div>
    </div>
  )
}

export function InProgressPanel({
  tasks,
  activeTimersByTaskId,
  onStopTimer,
  onOpenTaskDetail
}: InProgressPanelProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(true)
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Filter tasks that have active timers
  const activeTasks = tasks.filter((task) => activeTimersByTaskId.has(task.id))

  if (activeTasks.length === 0) {
    return null
  }

  // Collapsed sidebar view
  if (isCollapsed) {
    return (
      <div className="border-t px-2 py-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/10">
            <Circle className="h-3 w-3 text-red-500 fill-red-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-medium">{activeTasks.length}</span>
        </div>
        {activeTasks.map((task) => {
          const timer = activeTimersByTaskId.get(task.id)!
          return (
            <TaskCard
              key={task.id}
              task={task}
              timer={timer}
              onStopTimer={() => onStopTimer(task.id, timer.id)}
              onOpenDetail={() => onOpenTaskDetail(task)}
              isCollapsed={true}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="border-t">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-medium">
            {activeTasks.length}
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className={cn('px-3 pb-3 space-y-2 max-h-[50vh] overflow-y-auto')}>
          {activeTasks.map((task) => {
            const timer = activeTimersByTaskId.get(task.id)!
            return (
              <TaskCard
                key={task.id}
                task={task}
                timer={timer}
                onStopTimer={() => onStopTimer(task.id, timer.id)}
                onOpenDetail={() => onOpenTaskDetail(task)}
                isCollapsed={false}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
