import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { PostComposer } from './PostComposer'
import { PostRow } from './PostRow'
import { PostThreadDialog } from './PostThreadDialog'
import { usePostsFeed } from '../hooks/usePostsFeed'
import { useTodos } from '../hooks/useTodos'
import { usePostLists } from '../hooks/usePostLists'
import { useLocalDayBounds } from '../hooks/useLocalDayBounds'
import { groupPostsByLocalDay } from '../lib/post-day-groups'
import {
  emptyPostComposerAssociations,
  submitComposerPost,
  type PostComposerAssociations
} from '../lib/post-composer-associations'
import { Button } from './ui/button'

export function PostsView(): React.JSX.Element {
  const { from, to } = useLocalDayBounds()
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

  const { todos: todayTodos } = useTodos({ from, to })
  const { lists } = usePostLists()

  const dayGroups = useMemo(() => groupPostsByLocalDay(posts), [posts])

  const [postAssociations, setPostAssociations] = useState<PostComposerAssociations>(
    emptyPostComposerAssociations()
  )
  const [threadPostId, setThreadPostId] = useState<number | null>(null)

  const handleSubmit = useCallback(
    async (body: string) => {
      const hasCollection = postAssociations.favorite || postAssociations.lists.length > 0
      await submitComposerPost(body, postAssociations, {
        simpleCreate: createPost,
        refresh: hasCollection ? refetch : undefined
      })
      setPostAssociations(emptyPostComposerAssociations())
    },
    [createPost, postAssociations, refetch]
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
        if (
          first?.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !initialLoading &&
          !error
        ) {
          void loadMore()
        }
      },
      { root, rootMargin: '160px', threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, initialLoading, loadMore, posts.length, error])

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-8">
      <main className="flex min-h-0 flex-1 flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Posts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your full log, newest first. More load as you scroll.
          </p>
        </div>

        <PostComposer
          draftStorageKey={`techoo.posts.postDraft.v1.${from}`}
          associations={postAssociations}
          onAssociationsChange={setPostAssociations}
          onSubmit={handleSubmit}
          todosForSuggestion={todayTodos.filter((t) => t.done === 0)}
          listsForSuggestion={lists}
        />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <p className="text-destructive">Could not load posts.</p>
            <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {initialLoading && posts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>Loading posts…</p>
            </div>
          ) : posts.length === 0 && !error ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>No posts yet. Add one here or from the Today tab.</p>
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
                    aria-labelledby={`posts-day-${group.dayKey}`}
                  >
                    <div
                      className="absolute left-3 top-1.5 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-background bg-background shadow-sm"
                      style={{ borderColor: 'var(--amber)' }}
                      aria-hidden
                    />
                    <div className="pl-5">
                      <h3
                        id={`posts-day-${group.dayKey}`}
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
                            onOpenThread={(selected) => setThreadPostId(selected.id)}
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
      </main>
      <PostThreadDialog postId={threadPostId} open={threadPostId !== null} onOpenChange={(open) => !open && setThreadPostId(null)} />
    </div>
  )
}
