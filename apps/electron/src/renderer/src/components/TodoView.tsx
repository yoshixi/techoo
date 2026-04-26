import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Plus, Check, Trash2, Clock, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { Textarea } from './ui/textarea'
import { useTodos } from '../hooks/useTodos'
import { usePosts } from '../hooks/usePosts'
import { useLocalDayBounds } from '../hooks/useLocalDayBounds'
import type { Todo } from '../gen/api/schemas'

const DEFAULT_BLOCK_SEC = 30 * 60

/** Primary list scope — avoids mixing “today” with custom dates or “all open” with range. */
type ListScope = 'today' | 'range' | 'all'

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function toDateInputValue(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDayUnixFromDateInput(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor(d.getTime() / 1000)
}

function tsToSec(ts: string | null): number {
  return ts != null ? new Date(ts).getTime() / 1000 : 0
}

function isOverdue(todo: Todo, nowSec: number): boolean {
  if (todo.done === 1) return false
  if (todo.is_all_day === 1) return false
  if (todo.starts_at == null) return false
  const startSec = tsToSec(todo.starts_at)
  const endSec = todo.ends_at != null ? tsToSec(todo.ends_at) : startSec + DEFAULT_BLOCK_SEC
  return endSec < nowSec
}

function useNowSec(intervalMs = 30_000): number {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowSec
}

/* ------------------------------------------------------------------ */
/*  List scope — Today | custom Range | All open                        */
/* ------------------------------------------------------------------ */

function ScopeToggle({
  scope,
  onScopeChange
}: {
  scope: ListScope
  onScopeChange: (s: ListScope) => void
}): React.JSX.Element {
  const pill = (s: ListScope, label: string): React.JSX.Element => {
    const active = scope === s
    return (
      <button
        type="button"
        className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors sm:px-3"
        style={{
          background: active ? 'var(--text-dark)' : 'transparent',
          color: active ? '#fff' : 'var(--text-muted-custom)'
        }}
        onClick={() => onScopeChange(s)}
      >
        {active ? '● ' : ''}
        {label}
      </button>
    )
  }
  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-full p-0.5"
      style={{ background: 'var(--panel)' }}
      role="tablist"
      aria-label="Todo list scope"
    >
      {pill('today', 'Today')}
      {pill('range', 'Range')}
      {pill('all', 'All open')}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Quick-add composer                                                 */
/* ------------------------------------------------------------------ */

function TodoComposer({
  onCreateTodo
}: {
  onCreateTodo: (title: string, startsAt?: number, endsAt?: number) => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [showTime, setShowTime] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const dateLabel = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (selectedDate === todayStr) return 'Today'
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }, [selectedDate])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = title.trim()
      if (!trimmed) return

      if (!showTime) {
        onCreateTodo(trimmed)
        setTitle('')
        setStartTime('')
        setEndTime('')
        setShowDatePicker(false)
        inputRef.current?.focus()
        return
      }

      const baseDate = new Date(selectedDate + 'T00:00:00')
      let startsAt: number

      if (startTime) {
        const [h, m] = startTime.split(':').map(Number)
        baseDate.setHours(h, m, 0, 0)
        startsAt = Math.floor(baseDate.getTime() / 1000)
      } else {
        baseDate.setHours(9, 0, 0, 0)
        startsAt = Math.floor(baseDate.getTime() / 1000)
      }

      let endsAt: number | undefined
      if (endTime) {
        const [eh, em] = endTime.split(':').map(Number)
        const ed = new Date(selectedDate + 'T00:00:00')
        ed.setHours(eh, em, 0, 0)
        endsAt = Math.floor(ed.getTime() / 1000)
      }

      onCreateTodo(trimmed, startsAt, endsAt)
      setTitle('')
      setStartTime('')
      setEndTime('')
      setShowDatePicker(false)
      inputRef.current?.focus()
    },
    [title, showTime, startTime, endTime, selectedDate, onCreateTodo]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a todo..."
          className="flex-1 min-w-[160px] h-9"
        />
        <div className="relative shrink-0">
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent px-3 py-1.5 text-xs rounded-full"
            onClick={() => setShowDatePicker(!showDatePicker)}
          >
            {dateLabel} ▾
          </Badge>
          {showDatePicker && (
            <div
              className="absolute top-full right-0 mt-1 z-10 bg-white border rounded-lg shadow-md p-2"
              style={{ borderColor: 'var(--border-l)' }}
            >
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setShowDatePicker(false)
                }}
                className="text-xs border rounded px-2 py-1"
                style={{ borderColor: 'var(--border-l)' }}
              />
            </div>
          )}
        </div>
        <Badge
          variant="outline"
          className={`cursor-pointer hover:bg-accent px-3 py-1.5 text-xs rounded-full shrink-0 ${
            showTime ? 'bg-amber-50 border-amber-300' : ''
          }`}
          onClick={() => setShowTime(!showTime)}
        >
          <Clock className="w-3 h-3 mr-1" />
          Time
        </Badge>
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="rounded-full w-8 h-8 p-0"
          style={{ background: title.trim() ? 'var(--amber)' : undefined }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {showTime && (
        <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground flex-wrap">
          <span className="w-8">From</span>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-28 h-7 text-xs"
          />
          <span className="w-4">To</span>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-28 h-7 text-xs"
          />
        </div>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Todo row (open detail for edit)                                    */
/* ------------------------------------------------------------------ */

function TodoItem({
  todo,
  onToggleDone,
  onDeleteTodo,
  onSelect
}: {
  todo: Todo
  onToggleDone: (id: number, done: number) => void
  onDeleteTodo: (id: number) => void
  onSelect: (todo: Todo) => void
}): React.JSX.Element {
  const isDone = todo.done === 1
  const [justCompleted, setJustCompleted] = useState(false)
  const [fading, setFading] = useState(false)

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isDone) {
        setJustCompleted(true)
        onToggleDone(todo.id, todo.done)
        setTimeout(() => setFading(true), 600)
      } else {
        setJustCompleted(false)
        setFading(false)
        onToggleDone(todo.id, todo.done)
      }
    },
    [isDone, todo.id, todo.done, onToggleDone]
  )

  return (
    <div
      className={`group py-2.5 cursor-pointer hover:bg-accent/30 px-2 -mx-2 rounded transition-all duration-300 ${fading ? 'opacity-30 max-h-0 py-0 overflow-hidden' : 'opacity-100'}`}
      style={{ borderBottom: '0.5px solid var(--border-l)' }}
      onClick={() => onSelect(todo)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(todo)
        }
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center justify-center shrink-0 rounded transition-colors"
          style={{
            width: 16,
            height: 16,
            border: isDone ? 'none' : '1px solid #B0A494',
            borderRadius: 3,
            background: isDone ? 'var(--amber)' : 'transparent'
          }}
        >
          {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm relative">
            <span className={isDone || justCompleted ? 'text-muted-foreground' : ''}>{todo.title}</span>
            {(isDone || justCompleted) && (
              <span
                className="absolute left-0 top-1/2 h-[1px] bg-muted-foreground/60"
                style={{
                  animation: justCompleted ? 'strikethrough 400ms ease-out forwards' : undefined,
                  width: justCompleted ? undefined : '100%'
                }}
              />
            )}
          </span>
          {todo.is_all_day === 1 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              All day
            </Badge>
          )}
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {todo.starts_at != null ? (
            <Badge
              variant="outline"
              className="text-[11px] px-2 py-0.5 rounded gap-1 pointer-events-none"
            >
              <Clock className="w-3 h-3" />
              {formatTime(todo.starts_at!)}
              {todo.ends_at != null && ` – ${formatTime(todo.ends_at!)}`}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 rounded gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              No time
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteTodo(todo.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Todo detail dialog — view, related posts, edit                    */
/* ------------------------------------------------------------------ */

function TodoDetailDialog({
  todo,
  onClose,
  onUpdateTodo,
  onDeleteTodo,
  onToggleDone
}: {
  todo: Todo
  onClose: () => void
  onUpdateTodo: (
    id: number,
    data: {
      title?: string
      description?: string | null
      starts_at?: number | null
      ends_at?: number | null
      is_all_day?: number
    }
  ) => Promise<void>
  onDeleteTodo: (id: number) => Promise<void>
  onToggleDone: (id: number, done: number) => Promise<void>
}): React.JSX.Element {
  /** Wide window so linked posts from any day appear in the thread */
  const threadRange = useMemo(
    () => ({
      from: 0,
      to: Math.floor(Date.now() / 1000) + 86400 * 365 * 10,
      /** Backend range cap; load full thread instead of default range limit. */
      limit: 10_000
    }),
    []
  )

  const { posts, createPost, isLoading: postsLoading } = usePosts(threadRange)

  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(() => todo.description ?? '')
  const [dateStr, setDateStr] = useState(() =>
    todo.starts_at != null ? toDateInputValue(todo.starts_at) : toDateInputValue(todo.created_at)
  )
  const [startTime, setStartTime] = useState(() =>
    todo.starts_at != null
      ? `${String(new Date(todo.starts_at).getHours()).padStart(2, '0')}:${String(new Date(todo.starts_at).getMinutes()).padStart(2, '0')}`
      : ''
  )
  const [endTime, setEndTime] = useState(() =>
    todo.ends_at != null
      ? `${String(new Date(todo.ends_at).getHours()).padStart(2, '0')}:${String(new Date(todo.ends_at).getMinutes()).padStart(2, '0')}`
      : ''
  )
  const [allDay, setAllDay] = useState(todo.is_all_day === 1)
  const [saving, setSaving] = useState(false)
  const [threadReply, setThreadReply] = useState('')
  const [postingThread, setPostingThread] = useState(false)

  useEffect(() => {
    setTitle(todo.title)
    setDescription(todo.description ?? '')
    setDateStr(
      todo.starts_at != null ? toDateInputValue(todo.starts_at) : toDateInputValue(todo.created_at)
    )
    setStartTime(
      todo.starts_at != null
        ? `${String(new Date(todo.starts_at).getHours()).padStart(2, '0')}:${String(new Date(todo.starts_at).getMinutes()).padStart(2, '0')}`
        : ''
    )
    setEndTime(
      todo.ends_at != null
        ? `${String(new Date(todo.ends_at).getHours()).padStart(2, '0')}:${String(new Date(todo.ends_at).getMinutes()).padStart(2, '0')}`
        : ''
    )
    setAllDay(todo.is_all_day === 1)
    setThreadReply('')
  }, [todo.id, todo.title, todo.description, todo.starts_at, todo.ends_at, todo.is_all_day, todo.created_at])

  const relatedPosts = useMemo(() => {
    const linked = posts.filter((p) => p.todos.some((t) => t.id === todo.id))
    return [...linked].sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())
  }, [posts, todo.id])

  const buildSchedulePatch = useCallback(() => {
    if (allDay) {
      const dayStart = startOfDayUnixFromDateInput(dateStr)
      return {
        starts_at: dayStart,
        ends_at: null as number | null,
        is_all_day: 1 as const
      }
    }
    if (!startTime) {
      return { starts_at: null as null, ends_at: null as null, is_all_day: 0 as const }
    }
    const [sh, sm] = startTime.split(':').map(Number)
    const base = new Date(dateStr + 'T00:00:00')
    base.setHours(sh, sm, 0, 0)
    const starts_at = Math.floor(base.getTime() / 1000)
    let ends_at: number | null = null
    if (endTime) {
      const [eh, em] = endTime.split(':').map(Number)
      const end = new Date(dateStr + 'T00:00:00')
      end.setHours(eh, em, 0, 0)
      ends_at = Math.floor(end.getTime() / 1000)
    }
    return { starts_at, ends_at, is_all_day: 0 as const }
  }, [allDay, dateStr, startTime, endTime])

  const handleSave = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const sched = buildSchedulePatch()
      const descTrim = description.trim()
      await onUpdateTodo(todo.id, {
        title: trimmed,
        description: descTrim.length > 0 ? descTrim : null,
        starts_at: sched.starts_at,
        ends_at: sched.ends_at,
        is_all_day: sched.is_all_day
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }, [title, description, todo.id, buildSchedulePatch, onUpdateTodo, onClose])

  const handleAddThreadPost = useCallback(async () => {
    const trimmed = threadReply.trim()
    if (!trimmed) return
    setPostingThread(true)
    try {
      await createPost(trimmed, [], [todo.id])
      setThreadReply('')
    } finally {
      setPostingThread(false)
    }
  }, [threadReply, createPost, todo.id])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this todo? Linked posts stay in the log.')) return
    await onDeleteTodo(todo.id)
    onClose()
  }, [todo.id, onDeleteTodo, onClose])

  return (
    <DialogContent className="max-h-[90vh] max-w-md gap-0 overflow-y-auto p-5 sm:max-w-lg sm:p-6">
      <DialogHeader className="space-y-0 pb-4 text-left">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <DialogTitle className="font-title text-lg leading-tight">Edit todo</DialogTitle>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onToggleDone(todo.id, todo.done)}
            >
              {todo.done === 1 ? 'Mark incomplete' : 'Mark done'}
            </Button>
            {todo.done === 1 && (
              <Badge variant="default" className="text-[10px]">
                Done
              </Badge>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="todo-detail-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id="todo-detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="todo-detail-description" className="text-xs text-muted-foreground">
            Description
          </Label>
          <Textarea
            id="todo-detail-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes, context, links…"
            rows={4}
            className="min-h-[88px] resize-y text-sm"
          />
        </div>

        <div className="max-w-sm space-y-3 rounded-xl border border-border bg-muted/25 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Schedule</p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="todo-all-day" className="cursor-pointer text-sm font-normal">
              All day
            </Label>
            <Switch id="todo-all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="todo-detail-date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input
              id="todo-detail-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-9 w-[11.5rem] max-w-full text-sm"
            />
          </div>
          {!allDay && (
            <div className="flex flex-wrap items-end gap-3 pt-0.5">
              <div className="space-y-1">
                <Label htmlFor="todo-detail-start" className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  id="todo-detail-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 w-[7.25rem] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="todo-detail-end" className="text-xs text-muted-foreground">
                  End <span className="font-normal opacity-80">(optional)</span>
                </Label>
                <Input
                  id="todo-detail-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 w-[7.25rem] text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Created {formatDate(todo.created_at)}</p>

        <div className="space-y-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Post thread
          </h4>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Chronological log entries linked to this todo (from Today / Work or #tags).
          </p>
          {postsLoading && relatedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading posts…</p>
          ) : relatedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posts linked yet.</p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
              {relatedPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-lg border px-2.5 py-2 text-sm"
                  style={{
                    borderColor: 'var(--border-l)',
                    borderLeftWidth: 3,
                    borderLeftColor: 'var(--amber)'
                  }}
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-snug">{post.body}</p>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {formatTime(post.posted_at)} · {formatDate(post.posted_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="todo-thread-reply" className="text-xs text-muted-foreground">
              Add to thread
            </Label>
            <Textarea
              id="todo-thread-reply"
              value={threadReply}
              onChange={(e) => setThreadReply(e.target.value)}
              placeholder="Write a log entry for this todo…"
              rows={2}
              className="min-h-[52px] resize-y text-sm"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void handleAddThreadPost()
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={postingThread || !threadReply.trim()}
              onClick={() => void handleAddThreadPost()}
            >
              {postingThread ? 'Posting…' : 'Post to thread'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="destructive" size="sm" className="h-8 text-xs" onClick={() => void handleDelete()}>
            Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={saving || !title.trim()}
              style={{ background: 'var(--amber)' }}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

/* ------------------------------------------------------------------ */
/*  Sort                                                               */
/* ------------------------------------------------------------------ */

function sortTodos(todos: Todo[], pinIncompleteFirst: boolean): Todo[] {
  return [...todos].sort((a, b) => {
    if (pinIncompleteFirst && a.done !== b.done) return a.done - b.done
    if (a.starts_at != null && b.starts_at != null) {
      if (a.starts_at !== b.starts_at) return tsToSec(a.starts_at) - tsToSec(b.starts_at)
    } else if (a.starts_at != null) return -1
    else if (b.starts_at != null) return 1
    return tsToSec(a.created_at) - tsToSec(b.created_at)
  })
}

/* ------------------------------------------------------------------ */
/*  TodoView                                                           */
/* ------------------------------------------------------------------ */

export function TodoView(): React.JSX.Element {
  const [listScope, setListScope] = useState<ListScope>('today')
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showCompletedInRange, setShowCompletedInRange] = useState(false)
  const [showCompletedInAllMode, setShowCompletedInAllMode] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [titleSearch, setTitleSearch] = useState('')
  const [customFrom, setCustomFrom] = useState<string | null>(null)
  const [customTo, setCustomTo] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const showAll = listScope === 'all'

  const defaultBounds = useLocalDayBounds()
  const nowSec = useNowSec()

  const listRange = useMemo(() => {
    if (listScope === 'range' && customFrom && customTo) {
      const a = startOfDayUnixFromDateInput(customFrom)
      const b = startOfDayUnixFromDateInput(customTo) + 86400
      return { from: Math.min(a, b), to: Math.max(a, b) }
    }
    return defaultBounds
  }, [listScope, customFrom, customTo, defaultBounds])

  const rangeDatesReady = Boolean(customFrom && customTo)

  const useFetchAll = showAll && showCompletedInAllMode

  const { todos: rawTodos, isLoading, createTodo, updateTodo, toggleDone, deleteTodo } = useTodos(
    useFetchAll
      ? { fetchAll: true }
      : showAll
        ? { showAll: true }
        : {
            from: listRange.from,
            to: listRange.to,
            includeCompletedInRange: showCompletedInRange
          }
  )

  useEffect(() => {
    setSelectedTodo((prev) => {
      if (!prev) return prev
      const next = rawTodos.find((t) => t.id === prev.id)
      return next ?? null
    })
  }, [rawTodos])

  const filteredTodos = useMemo(() => {
    let t = rawTodos
    const q = titleSearch.trim().toLowerCase()
    if (q) t = t.filter((x) => x.title.toLowerCase().includes(q))
    if (overdueOnly) t = t.filter((x) => isOverdue(x, nowSec))
    if (useFetchAll && !showCompletedInAllMode) {
      t = t.filter((x) => x.done === 0)
    }
    if (!showAll && !showCompletedInRange) {
      t = t.filter((x) => x.done === 0)
    }
    const pinIncomplete = !showAll || showCompletedInRange || useFetchAll
    return sortTodos(t, pinIncomplete)
  }, [
    rawTodos,
    titleSearch,
    overdueOnly,
    nowSec,
    showAll,
    showCompletedInRange,
    useFetchAll,
    showCompletedInAllMode
  ])

  const clearCustomRange = useCallback(() => {
    setCustomFrom(null)
    setCustomTo(null)
  }, [])

  const handleScopeChange = useCallback((s: ListScope) => {
    if (s === 'today' || s === 'all') {
      setCustomFrom(null)
      setCustomTo(null)
    }
    if (s === 'all') {
      setShowCompletedInRange(false)
    } else {
      setShowCompletedInAllMode(false)
    }
    if (s === 'range') {
      setAdvancedOpen(true)
    }
    setListScope(s)
  }, [])

  const advancedActiveCount = useMemo(() => {
    let n = 0
    if (listScope === 'all') {
      if (showCompletedInAllMode) n++
    } else if (showCompletedInRange) {
      n++
    }
    if (overdueOnly) n++
    if (titleSearch.trim()) n++
    if (listScope === 'range' && (customFrom != null || customTo != null)) n++
    return n
  }, [
    listScope,
    showCompletedInRange,
    showCompletedInAllMode,
    overdueOnly,
    titleSearch,
    customFrom,
    customTo
  ])

  const clearAdvancedFilters = useCallback(() => {
    setShowCompletedInRange(false)
    setShowCompletedInAllMode(false)
    setOverdueOnly(false)
    setTitleSearch('')
    clearCustomRange()
    if (listScope === 'range') {
      setListScope('today')
    }
  }, [clearCustomRange, listScope])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div>
          <h2 className="font-title text-lg" style={{ color: 'var(--text-dark)' }}>
            ToDo
          </h2>
        </div>

        {/* Scope + advanced — left-aligned (matches More filters pl-1) */}
        <div className="flex shrink-0 flex-col gap-2">
          <div className="pl-1">
            <ScopeToggle scope={listScope} onScopeChange={handleScopeChange} />
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl py-2 pl-1 pr-2 text-left text-xs transition-colors hover:bg-accent/50"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            {advancedOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">More filters</span>
            {advancedActiveCount > 0 && (
              <Badge
                variant="outline"
                className="h-5 border-border px-2 text-xs font-normal tabular-nums text-muted-foreground"
              >
                {advancedActiveCount} active
              </Badge>
            )}
          </button>

          {advancedOpen && (
            <div className="mt-2 rounded-2xl border border-border bg-card px-3 py-3">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div className="flex min-w-[5.5rem] flex-col gap-1">
                  {listScope === 'all' ? (
                    <>
                      <Label htmlFor="adv-completed-all" className="text-[11px] text-muted-foreground">
                        Completed
                      </Label>
                      <Switch
                        id="adv-completed-all"
                        checked={showCompletedInAllMode}
                        onCheckedChange={setShowCompletedInAllMode}
                      />
                    </>
                  ) : (
                    <>
                      <Label htmlFor="adv-completed-range" className="text-[11px] text-muted-foreground">
                        Completed
                      </Label>
                      <Switch
                        id="adv-completed-range"
                        checked={showCompletedInRange}
                        onCheckedChange={setShowCompletedInRange}
                      />
                    </>
                  )}
                </div>

                <div className="flex min-w-[5.5rem] flex-col gap-1">
                  <Label htmlFor="adv-overdue" className="text-[11px] text-muted-foreground">
                    Overdue only
                  </Label>
                  <Switch id="adv-overdue" checked={overdueOnly} onCheckedChange={setOverdueOnly} />
                </div>

                {listScope === 'range' && (
                  <>
                    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
                      <Label htmlFor="adv-date-from" className="text-[11px] text-muted-foreground">
                        From
                      </Label>
                      <Input
                        id="adv-date-from"
                        type="date"
                        value={customFrom ?? ''}
                        onChange={(e) => setCustomFrom(e.target.value || null)}
                        className="h-8 w-full min-w-0 text-xs"
                      />
                    </div>
                    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
                      <Label htmlFor="adv-date-to" className="text-[11px] text-muted-foreground">
                        To
                      </Label>
                      <Input
                        id="adv-date-to"
                        type="date"
                        value={customTo ?? ''}
                        onChange={(e) => setCustomTo(e.target.value || null)}
                        className="h-8 w-full min-w-0 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleScopeChange('today')}
                    >
                      Use today
                    </Button>
                  </>
                )}
              </div>

              {listScope === 'range' && !rangeDatesReady && (
                <p className="mt-2 text-[11px] text-muted-foreground">Set From and To to load that span.</p>
              )}

              <Separator className="my-3" />

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="adv-title-search"
                  value={titleSearch}
                  onChange={(e) => setTitleSearch(e.target.value)}
                  placeholder="Search title…"
                  className="h-8 pl-8 text-xs"
                  aria-label="Search by title"
                />
              </div>

              {advancedActiveCount > 0 && (
                <div className="mt-3 flex justify-end border-t border-border pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={clearAdvancedFilters}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <TodoComposer onCreateTodo={createTodo} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {showAll && !showCompletedInAllMode
                ? 'No open todos.'
                : 'No todos match these filters.'}
            </p>
          ) : (
            filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggleDone={toggleDone}
                onDeleteTodo={deleteTodo}
                onSelect={setSelectedTodo}
              />
            ))
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedTodo)}
        onOpenChange={(open) => {
          if (!open) setSelectedTodo(null)
        }}
      >
        {selectedTodo && (
          <TodoDetailDialog
            todo={selectedTodo}
            onClose={() => setSelectedTodo(null)}
            onUpdateTodo={updateTodo}
            onDeleteTodo={deleteTodo}
            onToggleDone={toggleDone}
          />
        )}
      </Dialog>
    </div>
  )
}
