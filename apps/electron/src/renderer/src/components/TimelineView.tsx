import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { PostComposer, type PostComposerContext } from './PostComposer'
import { PostRow } from './PostRow'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { usePostsFeed } from '../hooks/usePostsFeed'
import { useTodos } from '../hooks/useTodos'
import { useLocalDayBounds } from '../hooks/useLocalDayBounds'
import { groupPostsByLocalDay } from '../lib/post-day-groups'
import type { Todo } from '../gen/api/schemas'

const DEFAULT_TODO_DURATION_SEC = 30 * 60

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

function pickNextTimedTodo(todos: Todo[], nowSec: number): Todo | null {
  const open = todos.filter((t) => t.done === 0 && t.is_all_day !== 1 && t.starts_at != null)
  const future = open.filter((t) => tsToSec(t.starts_at) > nowSec)
  if (future.length === 0) return null
  return future.reduce((a, b) => (tsToSec(a.starts_at!) <= tsToSec(b.starts_at!) ? a : b))
}

function usePeriodicNow(intervalMs = 30_000): number {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowSec
}

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
    main = `Next · ${next.title} · ${formatTime(next.starts_at)}`
  } else {
    main = 'No upcoming timed blocks today'
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

/** Slim sidebar: today’s timed blocks + open todos (no inline create). */
function TimelineSidePanel({
  todos,
  toggleDone
}: {
  todos: Todo[]
  toggleDone: (id: number, currentDone: number) => Promise<void>
}): React.JSX.Element {
  const nowSec = usePeriodicNow()
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

  return (
    <aside
      className="flex flex-col shrink-0 min-h-0 w-[272px] border-r py-3 px-3"
      style={{
        background: 'var(--panel)',
        borderColor: 'var(--border-l)'
      }}
    >
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
              <div
                key={todo.id}
                className="flex items-start gap-2 py-1.5"
                style={{ borderBottom: '0.5px solid var(--border-l)' }}
              >
                <button
                  type="button"
                  onClick={() => void toggleDone(todo.id, todo.done)}
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
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs leading-snug ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {todo.title}
                  </span>
                  {todo.starts_at != null ? (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 rounded gap-0.5 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(todo.starts_at)}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-3.5 rounded gap-0.5 shrink-0 text-muted-foreground"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      No time
                    </Badge>
                  )}
                </div>
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

  const { todos: todayTodos, toggleDone } = useTodos({
    from,
    to
  })

  const dayGroups = useMemo(() => groupPostsByLocalDay(posts), [posts])
  const [currentContext, setCurrentContext] = useState<PostComposerContext>(null)
  const nowSec = usePeriodicNow()

  const handleClearContext = useCallback(() => {
    setCurrentContext(null)
  }, [])

  const handleSubmit = useCallback(
    (body: string) => {
      const eventIds: number[] = currentContext?.type === 'event' ? [currentContext.id] : []
      const todoIds: number[] = currentContext?.type === 'todo' ? [currentContext.id] : []
      void createPost(body, eventIds, todoIds)
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

  return (
    <div className="flex flex-1 min-h-0">
      <TimelineSidePanel todos={todayTodos} toggleDone={toggleDone} />
      <main
        className="flex flex-col flex-1 min-h-0 py-4 px-5 overflow-hidden"
        style={{ background: 'var(--background)' }}
      >
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="shrink-0">
            <h2 className="font-title text-lg" style={{ color: 'var(--text-dark)' }}>
              Timeline
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Full log, newest first. Today&apos;s todos stay visible on the left for quick context.
            </p>
          </div>

          <LogFocusStatusLine todos={todayTodos} nowSec={nowSec} />

          <PostComposer
            compact={false}
            draftStorageKey={postDraftStorageKey}
            currentContext={currentContext}
            onClearContext={handleClearContext}
            onSubmit={handleSubmit}
            onSelectContext={setCurrentContext}
            todosForSuggestion={todayTodos.filter((t) => t.done === 0)}
          />

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
                <div className="relative shrink-0 pl-9">
                  <div
                    className="pointer-events-none absolute left-3 top-2.5 bottom-2.5 w-px bg-border"
                    aria-hidden
                  />
                  {dayGroups.map((group) => (
                    <section
                      key={group.dayKey}
                      className="relative pb-10 last:pb-3"
                      aria-labelledby={`timeline-day-${group.dayKey}`}
                    >
                      <div
                        className="absolute left-3 top-1.5 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-background bg-background shadow-sm"
                        style={{ borderColor: 'var(--amber)' }}
                        aria-hidden
                      />
                      <div className="pl-5">
                        <h3
                          id={`timeline-day-${group.dayKey}`}
                          className="font-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
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
    </div>
  )
}
