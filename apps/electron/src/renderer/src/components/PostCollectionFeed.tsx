import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { PostRow } from './PostRow'
import { PostThreadDialog } from './PostThreadDialog'
import { Button } from './ui/button'
import { patchApiV1PostsId, deleteApiV1PostsId } from '../gen/api/endpoints/techooAPI.gen'
import { useFilteredPostsFeed, type PostsFeedFilter } from '../hooks/useFilteredPostsFeed'
import { groupPostsByLocalDay } from '../lib/post-day-groups'

const TIMELINE_RAIL_LEFT_PX = 12

export function PostCollectionFeed({
  filter,
  emptyMessage,
  refreshKey = 0
}: {
  filter: PostsFeedFilter
  emptyMessage: string
  refreshKey?: number
}): React.JSX.Element {
  const [threadPostId, setThreadPostId] = React.useState<number | null>(null)
  const { posts, initialLoading, loadingMore, hasMore, error, loadMore, refetch } =
    useFilteredPostsFeed(filter)

  useEffect(() => {
    if (refreshKey > 0) void refetch()
  }, [refreshKey, refetch])

  const dayGroups = useMemo(() => groupPostsByLocalDay(posts), [posts])
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const updatePost = useCallback(
    async (id: number, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return
      await patchApiV1PostsId(id, { body: trimmed })
      await refetch()
    },
    [refetch]
  )

  const deletePost = useCallback(
    async (id: number) => {
      await deleteApiV1PostsId(id)
      await refetch()
    },
    [refetch]
  )

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

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <p className="text-destructive">Could not load posts.</p>
        <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (initialLoading && posts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>Loading posts…</p>
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      <div className="relative shrink-0">
        {dayGroups.map((group) => (
          <section
            key={group.dayKey}
            className="relative pb-10 last:pb-3"
            aria-labelledby={`collection-day-${group.dayKey}`}
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
                id={`collection-day-${group.dayKey}`}
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
                    onFavoriteToggled={filter.type === 'favorites' ? refetch : undefined}
                    onOpenThread={(selected) => setThreadPostId(selected.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
      {loadingMore && <p className="py-3 text-center text-xs text-muted-foreground">Loading more…</p>}
      {!hasMore && posts.length > 0 && (
        <p className="py-2 text-center text-[11px] text-muted-foreground">End of list</p>
      )}
      </div>
      <PostThreadDialog
        postId={threadPostId}
        open={threadPostId !== null}
        onOpenChange={(open) => !open && setThreadPostId(null)}
      />
    </div>
  )
}
