import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Check, Calendar, PenLine } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent } from './ui/dialog'
import { Badge } from './ui/badge'
import { CalendarViewInner, apiTodoToCalendar } from './CalendarView'
import { PostComposer, type PostComposerContext } from './PostComposer'
import { PostRow } from './PostRow'
import { useTodos } from '../hooks/useTodos'
import { usePosts } from '../hooks/usePosts'
import { useLocalDayBounds } from '../hooks/useLocalDayBounds'
import { useTodayFocusMode } from '../hooks/useTodayFocusMode'
import type { Post, Todo } from '../gen/api/schemas'

/* ------------------------------------------------------------------ */

const tsToSec = (ts: string | null): number => (ts != null ? new Date(ts).getTime() / 1000 : 0)

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Matches calendar default block length when `ends_at` is missing */
const DEFAULT_TODO_DURATION_SEC = 30 * 60

function pickRunningTodo(todos: Todo[], nowSec: number): Todo | null {
  const open = todos.filter((t) => t.done === 0)
  const inTimedWindow: Todo[] = []
  for (const t of open) {
    if (t.is_all_day === 1) continue
    if (t.starts_at == null) continue
    const startSec = tsToSec(t.starts_at)
    const endSec = t.ends_at != null ? tsToSec(t.ends_at) : startSec + DEFAULT_TODO_DURATION_SEC
    if (startSec <= nowSec && nowSec < endSec) inTimedWindow.push(t)
  }
  if (inTimedWindow.length > 0) {
    return inTimedWindow.reduce((a, b) => (tsToSec(a.starts_at) <= tsToSec(b.starts_at) ? a : b))
  }
  const allDay = open.filter((t) => t.is_all_day === 1)
  if (allDay.length > 0) return allDay[0]
  return null
}

function pickNextTimedTodo(todos: Todo[], nowSec: number): Todo | null {
  const open = todos.filter((t) => t.done === 0 && t.is_all_day !== 1 && t.starts_at != null)
  const future = open.filter((t) => tsToSec(t.starts_at) > nowSec)
  if (future.length === 0) return null
  return future.reduce((a, b) => (tsToSec(a.starts_at) <= tsToSec(b.starts_at) ? a : b))
}

function usePeriodicNow(intervalMs = 30_000): number {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowSec
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

/* ------------------------------------------------------------------ */
/*  V2 — Status above log composer                                      */
/* ------------------------------------------------------------------ */

function LogFocusStatusLine({ todos, nowSec }: { todos: Todo[]; nowSec: number }): React.JSX.Element {
  const running = pickRunningTodo(todos, nowSec)
  const next = pickNextTimedTodo(todos, nowSec)

  let main: string
  if (running) {
    if (running.is_all_day === 1) {
      main = `Now · ${running.title} · All day`
    } else if (running.starts_at != null) {
      const endTs =
        running.ends_at ??
        new Date(tsToSec(running.starts_at) * 1000 + DEFAULT_TODO_DURATION_SEC * 1000).toISOString()
      main = `Now · ${running.title} · until ${formatTime(endTs)}`
    } else {
      main = `Now · ${running.title}`
    }
  } else if (next && next.starts_at != null) {
    main = `Next · ${next.title} · ${formatTime(next.starts_at!)}`
  } else {
    main = 'No upcoming timed blocks'
  }

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs leading-snug shrink-0"
      style={{
        borderColor: 'var(--border-l)',
        background: 'var(--amber-light)',
        color: 'var(--amber-dark)'
      }}
    >
      {main}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Plan / Work toolbar (V1 + V2 hint)                                  */
/* ------------------------------------------------------------------ */

function TodayFocusToolbar({
  focusMode,
  onPlan,
  onWork
}: {
  focusMode: 'plan' | 'work'
  onPlan: () => void
  onWork: () => void
}): React.JSX.Element {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
  const mod = isMac ? '⌘' : 'Ctrl+'

  return (
    <div
      className="flex flex-col items-start gap-1 shrink-0 px-4 py-2"
      style={{
        borderBottom: '0.5px solid var(--border-l)',
        background: 'var(--panel)'
      }}
    >
      <div
        className="inline-flex gap-0.5 rounded-full p-0.5"
        style={{ background: 'var(--background)' }}
        role="group"
        aria-label="Today layout"
      >
        <button
          type="button"
          onClick={onPlan}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
          style={{
            background: focusMode === 'plan' ? 'var(--text-dark)' : 'transparent',
            color: focusMode === 'plan' ? '#fff' : 'var(--text-muted-custom)'
          }}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          Plan
        </button>
        <button
          type="button"
          onClick={onWork}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
          style={{
            background: focusMode === 'work' ? 'var(--text-dark)' : 'transparent',
            color: focusMode === 'work' ? '#fff' : 'var(--text-muted-custom)'
          }}
        >
          <PenLine className="h-3.5 w-3.5 shrink-0" />
          Work
        </button>
      </div>
      <span className="text-[10px] text-muted-foreground pl-0.5 tabular-nums">
        Toggle {mod}⇧L
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Work mode — slim schedule + todos                                   */
/* ------------------------------------------------------------------ */

function WorkSidePanel({
  todos,
  createTodo,
  toggleDone,
  onOpenPlan
}: {
  todos: Todo[]
  createTodo: (title: string, startsAt?: number, endsAt?: number) => Promise<void>
  toggleDone: (id: number, currentDone: number) => Promise<void>
  onOpenPlan: () => void
}): React.JSX.Element {
  const nowSec = usePeriodicNow()
  const scheduled = useMemo(() => {
    const open = todos.filter((t) => t.done === 0 && t.starts_at != null)
    return [...open].sort((a, b) => tsToSec(a.starts_at) - tsToSec(b.starts_at))
  }, [todos])

  return (
    <aside
      className="flex flex-col shrink-0 min-h-0 w-[272px] border-r py-3 px-3"
      style={{
        background: 'var(--panel)',
        borderColor: 'var(--border-l)'
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Schedule
      </p>
      <div className="max-h-[200px] min-h-0 overflow-y-auto space-y-1 mb-3">
        {scheduled.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timed todos today.</p>
        ) : (
          scheduled.map((todo) => {
            const endTs =
              todo.ends_at ??
              new Date(
                tsToSec(todo.starts_at) * 1000 + DEFAULT_TODO_DURATION_SEC * 1000
              ).toISOString()
            const isRunning = pickRunningTodo([todo], nowSec)?.id === todo.id
            return (
              <div
                key={todo.id}
                className="rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: isRunning ? 'var(--amber)' : 'var(--border-l)',
                  background: isRunning ? 'var(--amber-light)' : 'transparent'
                }}
              >
                <div className="font-medium leading-tight truncate">{todo.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {formatTime(todo.starts_at!)} – {formatTime(endTs)}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full shrink-0 mb-3 text-xs h-8"
        onClick={onOpenPlan}
      >
        Edit on calendar
      </Button>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        ToDo
      </p>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TodayTodoPanel
          todos={todos}
          createTodo={createTodo}
          toggleDone={toggleDone}
          omitHeading
          dense
        />
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/*  ToDo panel                                                          */
/* ------------------------------------------------------------------ */

function TodayTodoPanel({
  todos,
  createTodo,
  toggleDone,
  omitHeading,
  dense
}: {
  todos: Todo[]
  createTodo: (title: string, startsAt?: number, endsAt?: number) => Promise<void>
  toggleDone: (id: number, currentDone: number) => Promise<void>
  omitHeading?: boolean
  dense?: boolean
}): React.JSX.Element {
  const [newTitle, setNewTitle] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  const handleAdd = useCallback(() => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    createTodo(trimmed)
    setNewTitle('')
  }, [newTitle, createTodo])

  const completedCount = useMemo(() => todos.filter((t) => t.done === 1).length, [todos])

  const sortedTodos = useMemo(() => {
    const source = showCompleted ? todos : todos.filter((t) => t.done === 0)
    return [...source].sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done
      if (a.starts_at != null && b.starts_at != null) return tsToSec(a.starts_at) - tsToSec(b.starts_at)
      if (a.starts_at != null) return -1
      if (b.starts_at != null) return 1
      return tsToSec(a.created_at) - tsToSec(b.created_at)
    })
  }, [todos, showCompleted])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!omitHeading && (
        <div className="flex items-center justify-between mb-2">
          <span className="font-title text-sm" style={{ color: 'var(--text-dark)' }}>
            ToDo
          </span>
        </div>
      )}

      <form
        className={`flex gap-1.5 shrink-0 ${dense ? 'mb-2' : 'mb-3'}`}
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add todo..."
          className={`flex-1 text-xs ${dense ? 'h-7' : 'h-7'}`}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newTitle.trim()}
          className="h-7 w-7 p-0 rounded-full shrink-0"
          style={{ background: newTitle.trim() ? 'var(--amber)' : undefined }}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-0">
        {sortedTodos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            {todos.length === 0
              ? 'Add your first todo for today'
              : showCompleted
                ? 'No todos to show'
                : 'No open todos'}
          </p>
        ) : (
          sortedTodos.map((todo) => {
            const isDone = todo.done === 1
            return (
              <div
                key={todo.id}
                className="flex items-start gap-2 py-1.5"
                style={{ borderBottom: '0.5px solid var(--border-l)' }}
              >
                <button
                  type="button"
                  onClick={() => toggleDone(todo.id, todo.done)}
                  className="flex items-center justify-center shrink-0 mt-0.5 rounded"
                  style={{
                    width: 14,
                    height: 14,
                    border: isDone ? 'none' : '1px solid #B0A494',
                    borderRadius: 3,
                    background: isDone ? 'var(--amber)' : 'transparent'
                  }}
                >
                  {isDone && <Check size={8} color="#fff" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs leading-snug ${isDone ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {todo.title}
                  </span>
                  {todo.starts_at != null && (
                    <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-3.5 rounded">
                      {formatTime(todo.starts_at!)}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {completedCount > 0 && (
        <button
          type="button"
          className="mt-2 shrink-0 text-left text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          onClick={() => setShowCompleted((v) => !v)}
        >
          {showCompleted ? 'Hide completed' : `Show completed (${completedCount})`}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Log panel                                                           */
/* ------------------------------------------------------------------ */

function TodayLogPanel({
  posts,
  isLoading,
  createPost,
  updatePost,
  deletePost,
  todosForHashSuggest,
  composerContext,
  onComposerContextChange,
  layout,
  showStatusLine,
  todosForStatus,
  postDraftStorageKey
}: {
  posts: Post[]
  isLoading: boolean
  createPost: (body: string, eventIds: number[], todoIds: number[]) => Promise<void>
  updatePost: (id: number, body: string) => Promise<void>
  deletePost: (id: number) => Promise<void>
  todosForHashSuggest: Todo[]
  composerContext: PostComposerContext
  onComposerContextChange: (ctx: PostComposerContext) => void
  layout: 'compact' | 'comfortable'
  showStatusLine?: boolean
  todosForStatus?: Todo[]
  /** Persists composer draft per local calendar day */
  postDraftStorageKey: string
}): React.JSX.Element {
  const nowSec = usePeriodicNow()
  const handleSubmit = useCallback(
    (body: string) => {
      const eventIds: number[] = composerContext?.type === 'event' ? [composerContext.id] : []
      const todoIds: number[] = composerContext?.type === 'todo' ? [composerContext.id] : []
      void createPost(body, eventIds, todoIds)
    },
    [composerContext, createPost]
  )

  const sorted = useMemo(
    () => [...posts].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()),
    [posts]
  )

  const comfortable = layout === 'comfortable'

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${comfortable ? 'gap-4 px-2 py-1' : 'gap-2'}`}>
      {showStatusLine && todosForStatus && (
        <LogFocusStatusLine todos={todosForStatus} nowSec={nowSec} />
      )}

      <PostComposer
        compact={!comfortable}
        draftStorageKey={postDraftStorageKey}
        currentContext={composerContext}
        onClearContext={() => onComposerContextChange(null)}
        onSubmit={handleSubmit}
        onSelectContext={onComposerContextChange}
        todosForSuggestion={todosForHashSuggest}
      />

      <div
        className={`font-title uppercase tracking-wide text-muted-foreground pt-1 ${comfortable ? 'text-xs' : 'text-[11px]'}`}
      >
        Today&apos;s log
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className={`text-muted-foreground py-2 ${comfortable ? 'text-sm' : 'text-xs'}`}>
            No posts yet today.
          </p>
        ) : (
          sorted.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onUpdatePost={updatePost}
              onDelete={deletePost}
              variant={comfortable ? 'default' : 'compact'}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RailTabButton({
  active,
  label,
  onClick
}: {
  active: boolean
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 pb-2 text-xs transition-colors"
      style={{
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--text-dark)' : 'var(--text-muted-custom)',
        borderBottom: active ? '2px solid var(--amber)' : '2px solid transparent'
      }}
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  TodayView                                                           */
/* ------------------------------------------------------------------ */

export function TodayView(): React.JSX.Element {
  const { from: dayStart, to: dayEnd } = useLocalDayBounds()
  const postDraftStorageKey = `techoo.today.postDraft.v1.${dayStart}`
  const { todos, createTodo, updateTodo, deleteTodo, toggleDone } = useTodos({
    from: dayStart,
    to: dayEnd
  })
  const { posts, isLoading: postsLoading, createPost, updatePost, deletePost } = usePosts({
    from: dayStart,
    to: dayEnd
  })

  const { focusMode, setFocusMode, toggleFocusMode } = useTodayFocusMode()

  const [railTab, setRailTab] = useState<'todo' | 'log'>('todo')
  const [logComposerContext, setLogComposerContext] = useState<PostComposerContext>(null)
  const prevRailTab = useRef(railTab)
  const prevFocusMode = useRef(focusMode)

  const calendarTodos = useMemo(() => todos.map(apiTodoToCalendar), [todos])
  const todosForPostHash = useMemo(() => todos.filter((t) => t.done === 0), [todos])

  const applyRunningTodoContext = useCallback(() => {
    const nowSec = Math.floor(Date.now() / 1000)
    const running = pickRunningTodo(todos, nowSec)
    if (running) {
      setLogComposerContext({ type: 'todo', id: running.id, title: running.title })
    }
  }, [todos])

  useEffect(() => {
    const enteredLog = prevRailTab.current === 'todo' && railTab === 'log'
    prevRailTab.current = railTab
    if (!enteredLog) return
    applyRunningTodoContext()
  }, [railTab, todos, applyRunningTodoContext])

  useEffect(() => {
    const enteredWork = prevFocusMode.current === 'plan' && focusMode === 'work'
    prevFocusMode.current = focusMode
    if (!enteredWork) return
    applyRunningTodoContext()
  }, [focusMode, applyRunningTodoContext])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.shiftKey || (!e.metaKey && !e.ctrlKey)) return
      if (e.key.toLowerCase() !== 'l') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      toggleFocusMode()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFocusMode])

  const [createDraft, setCreateDraft] = useState<{
    title: string
    startTime: string
    endTime: string
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateRange = useCallback((range: { starts_at: number; ends_at: number }) => {
    const start = new Date(range.starts_at * 1000)
    const end = new Date(range.ends_at * 1000)
    const fmt = (d: Date): string =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setCreateDraft({ title: '', startTime: fmt(start), endTime: fmt(end) })
  }, [])

  const handleTodoMove = useCallback(
    async (todo: { id: number }, range: { starts_at: number; ends_at: number }) => {
      await updateTodo(todo.id, { starts_at: range.starts_at, ends_at: range.ends_at })
    },
    [updateTodo]
  )

  const handleTodoDelete = useCallback(
    async (todo: { id: number }) => {
      await deleteTodo(todo.id)
    },
    [deleteTodo]
  )

  const handleCreateSubmit = useCallback(async () => {
    if (!createDraft || !createDraft.title.trim()) return
    setIsCreating(true)
    try {
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
      setCreateDraft(null)
    } finally {
      setIsCreating(false)
    }
  }, [createDraft, createTodo])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TodayFocusToolbar
        focusMode={focusMode}
        onPlan={() => setFocusMode('plan')}
        onWork={() => setFocusMode('work')}
      />

      <div className="flex flex-1 min-h-0">
        {focusMode === 'plan' ? (
          <>
            <main className="flex flex-col flex-1 min-h-0">
              <CalendarViewInner
                todos={calendarTodos}
                viewMode="day"
                hideHeader
                onCreateRange={handleCreateRange}
                onTodoMove={handleTodoMove}
                onTodoDelete={handleTodoDelete}
              />
            </main>

            <aside
              className="flex flex-col shrink-0 min-h-0 py-4 px-3"
              style={{
                width: 268,
                background: 'var(--panel)',
                borderLeft: '0.5px solid var(--border-l)'
              }}
            >
              <div className="flex shrink-0 mb-2" style={{ borderBottom: '0.5px solid var(--border-l)' }}>
                <RailTabButton active={railTab === 'todo'} label="ToDo" onClick={() => setRailTab('todo')} />
                <RailTabButton active={railTab === 'log'} label="Log" onClick={() => setRailTab('log')} />
              </div>
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {railTab === 'todo' ? (
                  <TodayTodoPanel
                    omitHeading
                    todos={todos}
                    createTodo={createTodo}
                    toggleDone={toggleDone}
                  />
                ) : (
                  <TodayLogPanel
                    layout="compact"
                    posts={posts}
                    isLoading={postsLoading}
                    createPost={createPost}
                    updatePost={updatePost}
                    deletePost={deletePost}
                    todosForHashSuggest={todosForPostHash}
                    composerContext={logComposerContext}
                    onComposerContextChange={setLogComposerContext}
                    postDraftStorageKey={postDraftStorageKey}
                  />
                )}
              </div>
            </aside>
          </>
        ) : (
          <>
            <WorkSidePanel
              todos={todos}
              createTodo={createTodo}
              toggleDone={toggleDone}
              onOpenPlan={() => setFocusMode('plan')}
            />
            <main
              className="flex flex-col flex-1 min-h-0 py-4 px-5 overflow-hidden"
              style={{ background: 'var(--background)' }}
            >
              <TodayLogPanel
                layout="comfortable"
                showStatusLine
                todosForStatus={todos}
                posts={posts}
                isLoading={postsLoading}
                createPost={createPost}
                updatePost={updatePost}
                deletePost={deletePost}
                todosForHashSuggest={todosForPostHash}
                composerContext={logComposerContext}
                onComposerContextChange={setLogComposerContext}
                postDraftStorageKey={postDraftStorageKey}
              />
            </main>
          </>
        )}
      </div>

      <Dialog
        open={Boolean(createDraft)}
        onOpenChange={(open) => {
          if (!open && !isCreating) setCreateDraft(null)
        }}
      >
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <h3 className="font-title text-lg">New ToDo</h3>
            <Input
              value={createDraft?.title ?? ''}
              onChange={(e) => setCreateDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              placeholder="Todo title..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCreateSubmit()
                }
              }}
            />
            <div className="flex items-center gap-3 text-sm">
              <label className="text-muted-foreground w-12">From</label>
              <Input
                type="time"
                value={createDraft?.startTime ?? ''}
                onChange={(e) =>
                  setCreateDraft((d) => (d ? { ...d, startTime: e.target.value } : d))
                }
                className="w-32 h-8"
              />
              <label className="text-muted-foreground w-8">To</label>
              <Input
                type="time"
                value={createDraft?.endTime ?? ''}
                onChange={(e) => setCreateDraft((d) => (d ? { ...d, endTime: e.target.value } : d))}
                className="w-32 h-8"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateDraft(null)} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={isCreating || !createDraft?.title.trim()}
                style={{ background: 'var(--amber)' }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
