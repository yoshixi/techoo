import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock, SquarePen } from 'lucide-react'
import { PostComposer, type PostComposerContext } from './PostComposer'
import { PostRow } from './PostRow'
import { TodoDetailDialog } from './TodoView'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { usePostsFeed } from '../hooks/usePostsFeed'
import { useTodos } from '../hooks/useTodos'
import { useLocalDayBounds } from '../hooks/useLocalDayBounds'
import { groupPostsByLocalDay } from '../lib/post-day-groups'
import type { Todo } from '../gen/api/schemas'

const DEFAULT_TODO_DURATION_SEC = 30 * 60
const TIMELINE_RAIL_LEFT_PX = 12

const tsToSec = (ts: string | null): number => (ts != null ? new Date(ts).getTime() / 1000 : 0)

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

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
    return inTimedWindow.reduce((a, b) => (tsToSec(a.starts_at!) <= tsToSec(b.starts_at!) ? a : b))
  }
  const allDay = open.filter((t) => t.is_all_day === 1)
  if (allDay.length > 0) return allDay[0]
  return null
}

function usePeriodicNow(intervalMs = 30_000): number {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowSec
}

/** Slim sidebar: today’s timed blocks + open todos (no inline create). */
function TimelineSidePanel({
  todos,
  toggleDone,
  onTodoSelect
}: {
  todos: Todo[]
  toggleDone: (id: number, currentDone: number) => Promise<void>
  onTodoSelect?: (todo: Todo) => void
}): React.JSX.Element {
  const nowSec = usePeriodicNow()
  const runningTodo = useMemo(() => pickRunningTodo(todos, nowSec), [todos, nowSec])
  const scheduled = useMemo(() => {
    const open = todos.filter((t) => t.done === 0 && t.starts_at != null)
    return [...open].sort((a, b) => tsToSec(a.starts_at) - tsToSec(b.starts_at))
  }, [todos])

  const openList = useMemo(() => {
    const open = todos.filter((t) => t.done === 0)
    return [...open].sort((a, b) => {
      if (a.starts_at != null && b.starts_at != null) return tsToSec(a.starts_at) - tsToSec(b.starts_at)
      if (a.starts_at != null) return -1
      if (b.starts_at != null) return 1
      return tsToSec(a.created_at) - tsToSec(b.created_at)
    })
  }, [todos])
  const nextTodo = scheduled.find((t) => tsToSec(t.starts_at) > nowSec) ?? null

  return (
    <aside
      className="flex flex-col shrink-0 min-h-0 w-[272px] py-3 px-3 rounded-2xl"
      style={{
        background: 'color-mix(in srgb, var(--card) 76%, var(--panel) 24%)'
      }}
    >
      <div
        className="rounded-xl px-2.5 py-2.5 mb-3"
        style={{ background: 'color-mix(in srgb, var(--background) 66%, var(--card) 34%)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--card) 80%, white 20%)' }}>
            <div className="text-[10px] text-muted-foreground">Open</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-dark)' }}>{openList.length}</div>
          </div>
          <div className="rounded-lg px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--card) 80%, white 20%)' }}>
            <div className="text-[10px] text-muted-foreground">Scheduled</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-dark)' }}>{scheduled.length}</div>
          </div>
        </div>
        {runningTodo && (
          <p className="mt-2 truncate text-[11px]" style={{ color: 'var(--text-mid)' }}>
            Now: <span className="font-medium">{runningTodo.title}</span>
          </p>
        )}
        {!runningTodo && nextTodo && (
          <p className="mt-2 truncate text-[11px]" style={{ color: 'var(--text-mid)' }}>
            Next: <span className="font-medium">{nextTodo.title}</span>
          </p>
        )}
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Today · Schedule
      </p>
      <div className="max-h-[200px] min-h-0 overflow-y-auto space-y-1 mb-4">
        {scheduled.length === 0 ? (
          <p className="text-xs text-muted-foreground">No timed todos today.</p>
        ) : (
          scheduled.map((todo) => {
            const endTs =
              todo.ends_at ??
              new Date(tsToSec(todo.starts_at) * 1000 + DEFAULT_TODO_DURATION_SEC * 1000).toISOString()
            const isRunning = pickRunningTodo([todo], nowSec)?.id === todo.id
            return (
              <button
                key={todo.id}
                type="button"
                onClick={() => onTodoSelect?.(todo)}
                className="rounded-xl px-2.5 py-2 text-xs"
                style={{
                  background: isRunning
                    ? 'color-mix(in srgb, var(--amber-light) 70%, white 30%)'
                    : 'color-mix(in srgb, var(--background) 65%, var(--card) 35%)',
                  width: '100%'
                }}
              >
                <div className="font-medium leading-tight truncate">{todo.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {formatTime(todo.starts_at!)} – {formatTime(endTs)}
                </div>
              </button>
            )
          })
        )}
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        Today · ToDo
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0">
        {openList.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No open todos today.</p>
        ) : (
          openList.map((todo) => {
            const isDone = todo.done === 1
            return (
              <div key={todo.id} className="group flex items-start gap-2 py-1.5">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleDone(todo.id, todo.done)
                  }}
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
                <button
                  type="button"
                  onClick={() => onTodoSelect?.(todo)}
                  className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap text-left"
                >
                  <span className={`text-xs leading-snug ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {todo.title}
                  </span>
                  {todo.starts_at != null ? (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-3.5 rounded gap-0.5 shrink-0 border-transparent"
                      style={{ background: 'color-mix(in srgb, var(--background) 55%, var(--card) 45%)' }}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(todo.starts_at)}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-3.5 rounded gap-0.5 shrink-0 text-muted-foreground border-transparent"
                      style={{ background: 'color-mix(in srgb, var(--background) 55%, var(--card) 45%)' }}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      No time
                    </Badge>
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

/**
 * Full timeline of posts (feed) with a compact “today” sidebar like Today › Work.
 */
export function TimelineView(): React.JSX.Element {
  const { from, to } = useLocalDayBounds()
  const postDraftStorageKey = `techoo.timeline.postDraft.v1.${from}`

  const {
    posts,
    initialLoading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch,
    createPost,
    updatePost,
    deletePost
  } = usePostsFeed()

  const { todos: todayTodos, toggleDone, updateTodo, deleteTodo } = useTodos({
    from,
    to
  })

  const dayGroups = useMemo(() => groupPostsByLocalDay(posts), [posts])
  const [currentContext, setCurrentContext] = useState<PostComposerContext>(null)
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)

  const handleClearContext = useCallback(() => {
    setCurrentContext(null)
  }, [])

  const handleSubmit = useCallback(
    (body: string) => {
      const eventIds: number[] = currentContext?.type === 'event' ? [currentContext.id] : []
      const todoIds: number[] = currentContext?.type === 'todo' ? [currentContext.id] : []
      void createPost(body, eventIds, todoIds)
      setIsCreatePostDialogOpen(false)
      setCurrentContext(null)
    },
    [currentContext, createPost]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting && hasMore && !loadingMore && !initialLoading && !error) {
          void loadMore()
        }
      },
      { root, rootMargin: '160px', threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, initialLoading, loadMore, posts.length, error])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return
      if (event.key.toLowerCase() !== 'n') return
      event.preventDefault()
      setIsCreatePostDialogOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-1 min-h-0 gap-3 px-3 pb-3">
      <TimelineSidePanel todos={todayTodos} toggleDone={toggleDone} onTodoSelect={setSelectedTodo} />
      <main
        className="flex flex-col flex-1 min-h-0 py-4 px-5 overflow-hidden rounded-2xl"
        style={{ background: 'color-mix(in srgb, var(--card) 84%, white 16%)' }}
      >
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="shrink-0 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-xl font-semibold tracking-tight" style={{ color: 'var(--text-dark)' }}>
                Timeline
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Simple stream of notes and progress updates</p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs shrink-0"
              style={{ background: 'var(--amber)' }}
              onClick={() => setIsCreatePostDialogOpen(true)}
            >
              <SquarePen className="h-3.5 w-3.5" />
              Create post
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm shrink-0">
              <p className="text-destructive">Could not load posts.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          )}

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            {initialLoading && posts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>Loading posts…</p>
              </div>
            ) : posts.length === 0 && !error ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No posts yet.</p>
              </div>
            ) : (
              <>
                <div className="relative shrink-0">
                  {dayGroups.map((group) => (
                    <section
                      key={group.dayKey}
                      className="relative pb-10 last:pb-3"
                      aria-labelledby={`timeline-day-${group.dayKey}`}
                    >
                      <div
                        className="absolute top-1.5 z-10 h-2 w-2 -translate-x-1/2 rounded-full border border-background bg-background"
                        style={{
                          left: `${TIMELINE_RAIL_LEFT_PX}px`,
                          borderColor: 'color-mix(in srgb, var(--amber) 80%, white 20%)'
                        }}
                        aria-hidden
                      />
                      <div className="pl-5">
                        <h3
                          id={`timeline-day-${group.dayKey}`}
                          className="font-sans mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {group.label}
                        </h3>
                        <div className="space-y-2">
                          {group.posts.map((post) => (
                            <PostRow
                              key={post.id}
                              post={post}
                              onUpdatePost={updatePost}
                              onDelete={deletePost}
                            />
                          ))}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
                <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
                {loadingMore && (
                  <p className="py-3 text-center text-xs text-muted-foreground">Loading more…</p>
                )}
                {!hasMore && posts.length > 0 && (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">End of log</p>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Dialog
        open={isCreatePostDialogOpen}
        onOpenChange={(open) => {
          setIsCreatePostDialogOpen(open)
          if (!open) setCurrentContext(null)
        }}
      >
        <DialogContent className="max-w-[min(100vw-2rem,42rem)]">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-sans text-lg font-semibold tracking-tight">Create post</DialogTitle>
          </DialogHeader>
          <PostComposer
            compact={false}
            draftStorageKey={postDraftStorageKey}
            currentContext={currentContext}
            onClearContext={handleClearContext}
            onSubmit={handleSubmit}
            onSelectContext={setCurrentContext}
            todosForSuggestion={todayTodos.filter((t) => t.done === 0)}
          />
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
    </div>
  )
}
