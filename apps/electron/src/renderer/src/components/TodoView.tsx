import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Check, Trash2, Clock, Search, ChevronDown, ChevronRight, Send } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useTodos } from '../hooks/useTodos'
import { usePosts } from '../hooks/usePosts'
import type { Todo } from '../gen/api/schemas'
import { isMacPlatform } from '../lib/platform'

const DEFAULT_BLOCK_SEC = 30 * 60

function todayDateInputValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

type TodoSavePayload = {
  title: string
  description: string | null
  starts_at: number | null
  ends_at: number | null
  is_all_day: number
}

type ScheduleMode = 'none' | 'timed' | 'all_day'

const DEFAULT_DURATION_MIN = 30
const DURATION_OPTIONS_MINUTES = [15, 30, 45, 60, 90, 120]

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
/*  List filter — time range (default today) | all open                  */
/* ------------------------------------------------------------------ */

function FilterModeToggle({
  allOpenMode,
  onAllOpenModeChange
}: {
  allOpenMode: boolean
  onAllOpenModeChange: (allOpen: boolean) => void
}): React.JSX.Element {
  const pill = (active: boolean, label: string, onClick: () => void): React.JSX.Element => (
    <button
      type="button"
      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors sm:px-3"
      style={{
        background: active ? 'var(--text-dark)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted-custom)'
      }}
      onClick={onClick}
    >
      {active ? '● ' : ''}
      {label}
    </button>
  )
  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-full p-0.5"
      style={{ background: 'var(--panel)' }}
      role="tablist"
      aria-label="Todo list filter"
    >
      {pill(!allOpenMode, 'Time range', () => onAllOpenModeChange(false))}
      {pill(allOpenMode, 'All open', () => onAllOpenModeChange(true))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Todo row (open detail for edit)                                    */
/* ------------------------------------------------------------------ */

export function TodoItem({
  todo,
  onToggleDone,
  onDeleteTodo,
  onSelect,
  onQuickAdjustTime
}: {
  todo: Todo
  onToggleDone: (id: number, done: number) => void
  onDeleteTodo: (id: number) => void
  onSelect: (todo: Todo) => void
  onQuickAdjustTime: (todo: Todo) => void
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
      className={`group py-2.5 cursor-pointer hover:bg-accent/35 px-2 rounded-xl transition-all duration-300 ${fading ? 'opacity-30 max-h-0 py-0 overflow-hidden' : 'opacity-100'}`}
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

        <div className="shrink-0">
          {todo.starts_at != null ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onQuickAdjustTime(todo)
              }}
            >
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 rounded gap-1 hover:bg-accent/40">
                <Clock className="w-3 h-3" />
                {formatTime(todo.starts_at!)}
                {todo.ends_at != null && ` – ${formatTime(todo.ends_at!)}`}
              </Badge>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onQuickAdjustTime(todo)
              }}
            >
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5 rounded gap-1 text-muted-foreground hover:bg-accent/40"
              >
                <Clock className="w-3 h-3" />
                No time
              </Badge>
            </button>
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

export function TodoDetailDialog({
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
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (todo.starts_at == null || todo.ends_at == null) return String(DEFAULT_DURATION_MIN)
    const diffMin = Math.round((new Date(todo.ends_at).getTime() - new Date(todo.starts_at).getTime()) / 60000)
    return String(diffMin > 0 ? diffMin : DEFAULT_DURATION_MIN)
  })
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(() => {
    if (todo.is_all_day === 1) return 'all_day'
    if (todo.starts_at != null) return 'timed'
    return 'none'
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isMac = isMacPlatform()
  const [threadReply, setThreadReply] = useState('')
  const [postingThread, setPostingThread] = useState(false)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const lastSavedSerializedRef = useRef<string>('')
  const pendingRef = useRef<{ serialized: string; payload: TodoSavePayload } | null>(null)

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
    if (todo.starts_at != null && todo.ends_at != null) {
      const diffMin = Math.round((new Date(todo.ends_at).getTime() - new Date(todo.starts_at).getTime()) / 60000)
      setDurationMinutes(String(diffMin > 0 ? diffMin : DEFAULT_DURATION_MIN))
    } else {
      setDurationMinutes(String(DEFAULT_DURATION_MIN))
    }
    setScheduleMode(todo.is_all_day === 1 ? 'all_day' : todo.starts_at != null ? 'timed' : 'none')
    setThreadReply('')
    setSaveState('idle')
    const startsAtSec = todo.starts_at != null ? Math.floor(new Date(todo.starts_at).getTime() / 1000) : null
    const endsAtSec = todo.ends_at != null ? Math.floor(new Date(todo.ends_at).getTime() / 1000) : null
    lastSavedSerializedRef.current = JSON.stringify({
      title: todo.title,
      description: (todo.description ?? '').trim() || null,
      starts_at: startsAtSec,
      ends_at: endsAtSec,
      is_all_day: todo.is_all_day
    } satisfies TodoSavePayload)
    pendingRef.current = null
    inFlightRef.current = false
  }, [todo.id, todo.title, todo.description, todo.starts_at, todo.ends_at, todo.is_all_day, todo.created_at])

  const relatedPosts = useMemo(() => {
    const linked = posts.filter((p) => p.todos.some((t) => t.id === todo.id))
    return [...linked].sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())
  }, [posts, todo.id])

  const buildSchedulePatch = useCallback(() => {
    if (scheduleMode === 'none') {
      return { starts_at: null as null, ends_at: null as null, is_all_day: 0 as const }
    }
    if (scheduleMode === 'all_day') {
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
    const parsedDuration = Number.parseInt(durationMinutes, 10)
    const safeDurationMin =
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : DEFAULT_DURATION_MIN
    const ends_at = starts_at + safeDurationMin * 60
    return { starts_at, ends_at, is_all_day: 0 as const }
  }, [scheduleMode, dateStr, startTime, durationMinutes])

  const draftPayload = useMemo<TodoSavePayload | null>(() => {
    const trimmed = title.trim()
    if (!trimmed) return null
    const sched = buildSchedulePatch()
    const descTrim = description.trim()
    return {
      title: trimmed,
      description: descTrim.length > 0 ? descTrim : null,
      starts_at: sched.starts_at,
      ends_at: sched.ends_at,
      is_all_day: sched.is_all_day
    }
  }, [title, description, buildSchedulePatch])

  const persistDraft = useCallback(
    async (serialized: string, payload: TodoSavePayload) => {
      if (inFlightRef.current) {
        pendingRef.current = { serialized, payload }
        return
      }
      if (serialized === lastSavedSerializedRef.current) return
      inFlightRef.current = true
      setSaveState('saving')
      try {
        await onUpdateTodo(todo.id, payload)
        lastSavedSerializedRef.current = serialized
        setSaveState('saved')
      } catch {
        setSaveState('error')
      } finally {
        inFlightRef.current = false
        const next = pendingRef.current
        pendingRef.current = null
        if (next && next.serialized !== lastSavedSerializedRef.current) {
          void persistDraft(next.serialized, next.payload)
        }
      }
    },
    [onUpdateTodo, todo.id]
  )

  useEffect(() => {
    if (!draftPayload) return
    const serialized = JSON.stringify(draftPayload)
    if (serialized === lastSavedSerializedRef.current) return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      void persistDraft(serialized, draftPayload)
    }, 600)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [draftPayload, persistDraft])

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
    <DialogContent className="max-h-[90vh] w-full max-w-[min(100vw-2rem,36rem)] gap-0 overflow-y-auto p-5 sm:max-w-[min(100vw-3rem,52rem)] sm:p-6">
      <DialogHeader className="space-y-0 pb-1.5 text-left">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <DialogTitle className="sr-only">Edit todo</DialogTitle>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 text-xs"
              style={{ background: 'var(--amber)' }}
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

      <div className="flex flex-col gap-1.5">
        <div className="space-y-0.5 rounded-2xl bg-card/85 px-3 py-1">
          <Input
            id="todo-detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Todo title"
            className="h-10 !text-xl md:!text-xl font-semibold tracking-tight border-transparent bg-background/60 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
          />
        </div>

        <div className="space-y-0.5 rounded-2xl bg-card/85 px-3 py-1">
          <Textarea
            id="todo-detail-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes, context, links…"
            rows={4}
            className="min-h-[92px] resize-y text-sm border-transparent bg-background/60 shadow-none focus-visible:ring-2 focus-visible:ring-primary/25"
          />
        </div>

        <div className="w-full max-w-full space-y-3 rounded-2xl bg-card/85 px-3 py-3 sm:max-w-none">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Schedule</p>
            <div
              className="inline-flex flex-wrap items-center gap-1 rounded-full p-0.5"
              style={{ background: 'color-mix(in srgb, var(--background) 78%, white 22%)' }}
              role="tablist"
              aria-label="Schedule mode"
            >
              {(
                [
                  { id: 'none' as const, label: 'No schedule' },
                  { id: 'timed' as const, label: 'Time block' },
                  { id: 'all_day' as const, label: 'All day' }
                ] satisfies Array<{ id: ScheduleMode; label: string }>
              ).map((mode) => {
                const active = scheduleMode === mode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'var(--text-dark)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted-custom)'
                    }}
                    onClick={() => {
                      if (mode.id === 'none' && scheduleMode !== 'none') {
                        if (
                          !window.confirm('Clear this todo schedule? Date/time settings will be removed.')
                        )
                          return
                        setStartTime('')
                        setDurationMinutes(String(DEFAULT_DURATION_MIN))
                      }
                      if (mode.id === 'timed' && !startTime) {
                        setStartTime('09:00')
                      }
                      setScheduleMode(mode.id)
                    }}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>
          </div>
          {scheduleMode === 'all_day' && (
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
          )}
          {scheduleMode === 'timed' && (
            <div className="flex flex-wrap items-end gap-3 pt-0.5">
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
                <Label htmlFor="todo-detail-duration" className="text-xs text-muted-foreground">
                  Duration
                </Label>
                <div className="flex items-center gap-1.5">
                  <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                    <SelectTrigger id="todo-detail-duration" className="h-8 w-[7.5rem] rounded-md px-2 text-sm">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS_MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m === 60 ? '1 hour' : `${m} min`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          {scheduleMode === 'none' && (
            <p className="text-[11px] text-muted-foreground">This todo has no schedule.</p>
          )}
        </div>

        <div className="space-y-2.5 rounded-2xl bg-card/85 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground">Thread</h4>
            <Badge variant="outline" className="h-5 px-2 text-[10px]">
              {relatedPosts.length}
            </Badge>
          </div>
          {postsLoading && relatedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Loading posts…</p>
          ) : relatedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
              {relatedPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl px-3 py-2.5 text-sm"
                  style={{
                    background: 'color-mix(in srgb, var(--background) 70%, var(--card) 30%)'
                  }}
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: 'var(--text-dark)' }}>
                    {post.body}
                  </p>
                  <span className="mt-1 block text-[10px] text-muted-foreground/90">
                    {formatTime(post.posted_at)} · {formatDate(post.posted_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'color-mix(in srgb, var(--card) 82%, var(--background) 18%)',
              border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)'
            }}
          >
            <div className="relative">
              <Textarea
                id="todo-thread-reply"
                value={threadReply}
                onChange={(e) => setThreadReply(e.target.value)}
                placeholder="Write something... (this will be posted to thread)"
                rows={2}
                className="min-h-[96px] resize-none pr-12 border-transparent bg-background/55 shadow-none focus-visible:ring-2 focus-visible:ring-primary/30 text-sm leading-relaxed"
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
                variant="default"
                className="absolute bottom-2 right-2 h-7 w-7 p-0 rounded-full"
                style={{ background: 'var(--amber)' }}
                disabled={postingThread || !threadReply.trim()}
                onClick={() => void handleAddThreadPost()}
                title={postingThread ? 'Posting…' : 'Post to thread'}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="mt-1.5 block text-[11px] text-muted-foreground">
              Press {isMac ? '⌘' : 'Ctrl'}+Enter to post
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <Button type="button" variant="destructive" size="sm" className="h-8 text-xs" onClick={() => void handleDelete()}>
            Delete
          </Button>
          <div className="flex gap-2">
            <span className="self-center text-[11px] text-muted-foreground px-1">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : saveState === 'error'
                    ? 'Save failed'
                    : ''}
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              Close
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

export type TodoViewProps = {
  /** Narrow layout for split Todo tab (calendar + list). */
  variant?: 'page' | 'column'
  className?: string
  /** Controlled selection for split layout (calendar + list share detail). */
  selectedTodo?: Todo | null
  onSelectedTodoChange?: (todo: Todo | null) => void
}

export function TodoView({
  variant = 'page',
  className,
  selectedTodo: controlledSelected,
  onSelectedTodoChange
}: TodoViewProps = {}): React.JSX.Element {
  const [internalSelected, setInternalSelected] = useState<Todo | null>(null)
  const controlled =
    controlledSelected !== undefined && onSelectedTodoChange !== undefined
  const selectedTodo = controlled ? controlledSelected! : internalSelected
  const setSelectedTodo = useCallback(
    (t: Todo | null) => {
      if (controlled) onSelectedTodoChange!(t)
      else setInternalSelected(t)
    },
    [controlled, onSelectedTodoChange]
  )

  const [allOpenMode, setAllOpenMode] = useState(false)
  const [rangeFrom, setRangeFrom] = useState(todayDateInputValue)
  const [rangeTo, setRangeTo] = useState(todayDateInputValue)
  const [createDraft, setCreateDraft] = useState<{
    title: string
    startTime: string
    endTime: string
    useSchedule: boolean
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [showCompletedInRange, setShowCompletedInRange] = useState(false)
  const [showCompletedInAllMode, setShowCompletedInAllMode] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [titleSearch, setTitleSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [quickTimeDraft, setQuickTimeDraft] = useState<{
    todoId: number
    dateStr: string
    startTime: string
    durationMinutes: string
  } | null>(null)
  const [quickTimeSaveState, setQuickTimeSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const quickTimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickTimeInFlightRef = useRef(false)
  const quickTimeLastSavedRef = useRef<string>('')
  const quickTimePendingRef = useRef<{
    serialized: string
    payload: { todoId: number; starts_at: number; ends_at: number; is_all_day: number }
  } | null>(null)

  const nowSec = useNowSec()

  const listRange = useMemo(() => {
    const a = startOfDayUnixFromDateInput(rangeFrom)
    const b = startOfDayUnixFromDateInput(rangeTo) + 86400
    return { from: Math.min(a, b), to: Math.max(a, b) }
  }, [rangeFrom, rangeTo])

  const useFetchAll = allOpenMode && showCompletedInAllMode

  const { todos: rawTodos, isLoading, createTodo, updateTodo, toggleDone, deleteTodo } = useTodos(
    useFetchAll
      ? { fetchAll: true }
      : allOpenMode
        ? { showAll: true }
        : {
          from: listRange.from,
          to: listRange.to,
          includeCompletedInRange: showCompletedInRange
        }
  )

  useEffect(() => {
    if (!selectedTodo) return
    const next = rawTodos.find((t) => t.id === selectedTodo.id)
    if (!next) setSelectedTodo(null)
  }, [rawTodos, selectedTodo?.id, setSelectedTodo])

  const filteredTodos = useMemo(() => {
    let t = rawTodos
    const q = titleSearch.trim().toLowerCase()
    if (q) t = t.filter((x) => x.title.toLowerCase().includes(q))
    if (overdueOnly) t = t.filter((x) => isOverdue(x, nowSec))
    if (useFetchAll && !showCompletedInAllMode) {
      t = t.filter((x) => x.done === 0)
    }
    if (!allOpenMode && !showCompletedInRange) {
      t = t.filter((x) => x.done === 0)
    }
    const pinIncomplete = !allOpenMode || showCompletedInRange || useFetchAll
    return sortTodos(t, pinIncomplete)
  }, [
    rawTodos,
    titleSearch,
    overdueOnly,
    nowSec,
    allOpenMode,
    showCompletedInRange,
    useFetchAll,
    showCompletedInAllMode
  ])

  const handleAllOpenModeChange = useCallback((open: boolean) => {
    setAllOpenMode(open)
    if (open) {
      setShowCompletedInRange(false)
    } else {
      setShowCompletedInAllMode(false)
    }
  }, [])

  const advancedActiveCount = useMemo(() => {
    let n = 0
    if (allOpenMode) {
      if (showCompletedInAllMode) n++
    } else if (showCompletedInRange) {
      n++
    }
    if (overdueOnly) n++
    if (titleSearch.trim()) n++
    return n
  }, [allOpenMode, showCompletedInRange, showCompletedInAllMode, overdueOnly, titleSearch])

  const clearAdvancedFilters = useCallback(() => {
    setShowCompletedInRange(false)
    setShowCompletedInAllMode(false)
    setOverdueOnly(false)
    setTitleSearch('')
  }, [])

  const openCreateDialog = useCallback(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)
    const fmt = (d: Date): string =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setCreateDraft({ title: '', startTime: fmt(now), endTime: fmt(end), useSchedule: false })
  }, [])

  const openQuickTimeAdjust = useCallback((todo: Todo) => {
    const starts = todo.starts_at != null ? new Date(todo.starts_at) : new Date()
    const dateStr = `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, '0')}-${String(starts.getDate()).padStart(2, '0')}`
    const startTime = `${String(starts.getHours()).padStart(2, '0')}:${String(starts.getMinutes()).padStart(2, '0')}`
    const durationMinutes =
      todo.starts_at != null && todo.ends_at != null
        ? String(Math.max(1, Math.round((new Date(todo.ends_at).getTime() - new Date(todo.starts_at).getTime()) / 60000)))
        : String(DEFAULT_DURATION_MIN)
    const startsAt = todo.starts_at != null ? Math.floor(new Date(todo.starts_at).getTime() / 1000) : null
    const endsAt = todo.ends_at != null ? Math.floor(new Date(todo.ends_at).getTime() / 1000) : null
    quickTimeLastSavedRef.current = JSON.stringify({
      todoId: todo.id,
      starts_at: startsAt,
      ends_at: endsAt,
      is_all_day: todo.is_all_day
    })
    setQuickTimeSaveState('idle')
    setQuickTimeDraft({ todoId: todo.id, dateStr, startTime, durationMinutes })
  }, [])

  const quickTimePayload = useMemo(() => {
    if (!quickTimeDraft) return null
    const [sh, sm] = quickTimeDraft.startTime.split(':').map(Number)
    if (!Number.isFinite(sh) || !Number.isFinite(sm)) return null
    const parsedDuration = Number.parseInt(quickTimeDraft.durationMinutes, 10)
    const safeDurationMin =
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : DEFAULT_DURATION_MIN
    const base = new Date(quickTimeDraft.dateStr + 'T00:00:00')
    base.setHours(sh, sm, 0, 0)
    const starts_at = Math.floor(base.getTime() / 1000)
    const ends_at = starts_at + safeDurationMin * 60
    return {
      todoId: quickTimeDraft.todoId,
      starts_at,
      ends_at,
      is_all_day: 0
    }
  }, [quickTimeDraft])

  const persistQuickTime = useCallback(
    async (
      serialized: string,
      payload: { todoId: number; starts_at: number; ends_at: number; is_all_day: number }
    ) => {
      if (quickTimeInFlightRef.current) {
        quickTimePendingRef.current = { serialized, payload }
        return
      }
      if (serialized === quickTimeLastSavedRef.current) return
      quickTimeInFlightRef.current = true
      setQuickTimeSaveState('saving')
      try {
        await updateTodo(payload.todoId, {
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
          is_all_day: payload.is_all_day
        })
        quickTimeLastSavedRef.current = serialized
        setQuickTimeSaveState('saved')
      } catch {
        setQuickTimeSaveState('error')
      } finally {
        quickTimeInFlightRef.current = false
        const next = quickTimePendingRef.current
        quickTimePendingRef.current = null
        if (next && next.serialized !== quickTimeLastSavedRef.current) {
          void persistQuickTime(next.serialized, next.payload)
        }
      }
    },
    [updateTodo]
  )

  useEffect(() => {
    if (!quickTimePayload) return
    const serialized = JSON.stringify(quickTimePayload)
    if (serialized === quickTimeLastSavedRef.current) return
    if (quickTimeDebounceRef.current) clearTimeout(quickTimeDebounceRef.current)
    quickTimeDebounceRef.current = setTimeout(() => {
      void persistQuickTime(serialized, quickTimePayload)
    }, 400)
    return () => {
      if (quickTimeDebounceRef.current) clearTimeout(quickTimeDebounceRef.current)
    }
  }, [quickTimePayload, persistQuickTime])

  const handleCreateSubmit = useCallback(async () => {
    if (!createDraft || !createDraft.title.trim()) return
    setIsCreating(true)
    try {
      if (!createDraft.useSchedule) {
        await createTodo(createDraft.title.trim())
      } else {
        const today = new Date()
        const [sh, sm] = createDraft.startTime.split(':').map(Number)
        const [eh, em] = createDraft.endTime.split(':').map(Number)
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm)
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eh, em)
        await createTodo(
          createDraft.title.trim(),
          Math.floor(startDate.getTime() / 1000),
          Math.floor(endDate.getTime() / 1000)
        )
      }
      setCreateDraft(null)
    } finally {
      setIsCreating(false)
    }
  }, [createDraft, createTodo])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openCreateDialog()
        return
      }

      // Tab/Shift+Tab cycles todo detail focus when dialogs are closed and user is not typing in a field.
      if (
        event.key === 'Tab' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.defaultPrevented &&
        !createDraft &&
        !quickTimeDraft &&
        !selectedTodo &&
        !isEditableTarget(event.target)
      ) {
        if (filteredTodos.length === 0) return
        event.preventDefault()
        if (event.shiftKey) {
          setSelectedTodo(filteredTodos[filteredTodos.length - 1] ?? null)
          return
        }
        setSelectedTodo(filteredTodos[0] ?? null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openCreateDialog, filteredTodos, createDraft, quickTimeDraft, selectedTodo, setSelectedTodo])

  useEffect(() => {
    if (!selectedTodo || filteredTodos.length === 0) return
    const currentIdx = filteredTodos.findIndex((todo) => todo.id === selectedTodo.id)
    if (currentIdx === -1) return

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const handleDialogTabCycle = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Tab' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        createDraft ||
        quickTimeDraft ||
        isEditableTarget(event.target)
      ) {
        return
      }
      event.preventDefault()
      const direction = event.shiftKey ? -1 : 1
      const nextIdx = (currentIdx + direction + filteredTodos.length) % filteredTodos.length
      setSelectedTodo(filteredTodos[nextIdx] ?? null)
    }

    window.addEventListener('keydown', handleDialogTabCycle)
    return () => window.removeEventListener('keydown', handleDialogTabCycle)
  }, [selectedTodo?.id, filteredTodos, createDraft, quickTimeDraft, setSelectedTodo])

  const padding = variant === 'column' ? 'px-4 py-3' : 'p-6'

  return (
    <div
      className={`flex flex-1 min-h-0 flex-col overflow-hidden ${padding} ${className ?? ''}`}
      style={variant === 'column' ? { background: 'transparent' } : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2 shrink-0">
          <div>
            <h2
              className="font-sans text-lg font-semibold tracking-tight"
              style={{ color: 'color-mix(in srgb, var(--text-dark) 72%, var(--text-muted-custom) 28%)' }}
            >
              ToDo
            </h2>
            {variant === 'column' && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Filter and manage tasks; calendar on the left.
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1 rounded-full h-8 text-xs"
            style={{ background: 'var(--amber)' }}
            onClick={openCreateDialog}
          >
            <Plus className="w-3.5 h-3.5" />
            Create todo
          </Button>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <div className="pl-1">
            <FilterModeToggle allOpenMode={allOpenMode} onAllOpenModeChange={handleAllOpenModeChange} />
          </div>

          {!allOpenMode && (
            <div className="flex flex-wrap items-end gap-3 pl-1">
              <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
                <Label htmlFor="todo-range-from" className="text-[11px] text-muted-foreground">
                  From
                </Label>
                <Input
                  id="todo-range-from"
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="h-8 w-full min-w-0 text-xs"
                />
              </div>
              <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
                <Label htmlFor="todo-range-to" className="text-[11px] text-muted-foreground">
                  To
                </Label>
                <Input
                  id="todo-range-to"
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="h-8 w-full min-w-0 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-full px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const t = todayDateInputValue()
                  setRangeFrom(t)
                  setRangeTo(t)
                }}
              >
                Reset to today
              </Button>
            </div>
          )}

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
            <div className="mt-1 rounded-2xl bg-card/80 px-3 py-3">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div className="flex min-w-[5.5rem] flex-col gap-1">
                  {allOpenMode ? (
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
              </div>

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

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {allOpenMode && !showCompletedInAllMode
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
                onSelect={(t) => setSelectedTodo(t)}
                onQuickAdjustTime={openQuickTimeAdjust}
              />
            ))
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(createDraft)}
        onOpenChange={(open) => {
          if (!open && !isCreating) setCreateDraft(null)
        }}
      >
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left p-0">
              <DialogTitle className="font-sans text-lg font-semibold tracking-tight">New todo</DialogTitle>
            </DialogHeader>
            <Input
              value={createDraft?.title ?? ''}
              onChange={(e) => setCreateDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              placeholder="Title…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleCreateSubmit()
                }
              }}
            />
            <div className="flex items-center justify-between gap-3 py-1 text-sm">
              <Label htmlFor="todo-create-schedule" className="text-sm font-normal cursor-pointer">
                Add schedule
              </Label>
              <Switch
                id="todo-create-schedule"
                checked={createDraft?.useSchedule ?? false}
                onCheckedChange={(v) => setCreateDraft((d) => (d ? { ...d, useSchedule: v } : d))}
              />
            </div>
            {createDraft?.useSchedule && (
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <label className="text-muted-foreground w-12 shrink-0">From</label>
                <Input
                  type="time"
                  value={createDraft?.startTime ?? ''}
                  onChange={(e) =>
                    setCreateDraft((d) => (d ? { ...d, startTime: e.target.value } : d))
                  }
                  className="w-32 h-8"
                />
                <label className="text-muted-foreground w-8 shrink-0">To</label>
                <Input
                  type="time"
                  value={createDraft?.endTime ?? ''}
                  onChange={(e) => setCreateDraft((d) => (d ? { ...d, endTime: e.target.value } : d))}
                  className="w-32 h-8"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateDraft(null)} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateSubmit()}
                disabled={isCreating || !createDraft?.title.trim()}
                style={{ background: 'var(--amber)' }}
              >
                {isCreating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={Boolean(quickTimeDraft)}
        onOpenChange={(open) => {
          if (!open) setQuickTimeDraft(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <DialogHeader className="space-y-1 text-left p-0">
              <DialogTitle className="font-sans text-lg font-semibold tracking-tight">Quick time adjust</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="quick-time-date" className="text-xs text-muted-foreground">
                Date
              </Label>
              <Input
                id="quick-time-date"
                type="date"
                value={quickTimeDraft?.dateStr ?? ''}
                onChange={(e) =>
                  setQuickTimeDraft((d) => (d ? { ...d, dateStr: e.target.value } : d))
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="quick-time-start" className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  id="quick-time-start"
                  type="time"
                  value={quickTimeDraft?.startTime ?? ''}
                  onChange={(e) =>
                    setQuickTimeDraft((d) => (d ? { ...d, startTime: e.target.value } : d))
                  }
                  className="h-9 w-[7.25rem] text-sm"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="quick-time-duration" className="text-xs text-muted-foreground">
                  Duration
                </Label>
                <Select
                  value={quickTimeDraft?.durationMinutes ?? String(DEFAULT_DURATION_MIN)}
                  onValueChange={(v) =>
                    setQuickTimeDraft((d) => (d ? { ...d, durationMinutes: v } : d))
                  }
                >
                  <SelectTrigger id="quick-time-duration" className="h-9 rounded-md text-sm">
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS_MINUTES.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m === 60 ? '1 hour' : `${m} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!quickTimeDraft) return
                  setQuickTimeSaveState('saving')
                  try {
                    await updateTodo(quickTimeDraft.todoId, { starts_at: null, ends_at: null, is_all_day: 0 })
                    quickTimeLastSavedRef.current = JSON.stringify({
                      todoId: quickTimeDraft.todoId,
                      starts_at: null,
                      ends_at: null,
                      is_all_day: 0
                    })
                    setQuickTimeDraft(null)
                  } finally {
                    setQuickTimeSaveState('idle')
                  }
                }}
                disabled={quickTimeSaveState === 'saving'}
              >
                Clear schedule
              </Button>
              <div className="flex gap-2">
                <span className="self-center text-[11px] text-muted-foreground px-1">
                  {quickTimeSaveState === 'saving'
                    ? 'Saving…'
                    : quickTimeSaveState === 'saved'
                      ? 'Saved'
                      : quickTimeSaveState === 'error'
                        ? 'Save failed'
                        : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setQuickTimeDraft(null)}
                  disabled={quickTimeSaveState === 'saving'}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
