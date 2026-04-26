import { useCallback, useEffect, useState } from 'react'
import {
  getApiV1Posts,
  postApiV1Posts,
  patchApiV1PostsId,
  deleteApiV1PostsId
} from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, Post } from '../gen/api/schemas'

const DEFAULT_PAGE_SIZE = 30

/**
 * All posts, newest first, with offset pagination (for the Posts tab).
 * Range-based `usePosts` is still used for Today / todo threads.
 */
export function usePostsFeed(pageSize = DEFAULT_PAGE_SIZE): {
  posts: Post[]
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: ErrorResponse | undefined
  loadMore: () => Promise<void>
  createPost: (body: string, eventIds: number[], todoIds: number[]) => Promise<void>
  updatePost: (id: number, body: string) => Promise<void>
  deletePost: (id: number) => Promise<void>
  refetch: () => Promise<void>
} {
  const [posts, setPosts] = useState<Post[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ErrorResponse | undefined>()

  const fetchInitial = useCallback(async () => {
    setError(undefined)
    const res = await getApiV1Posts({ limit: pageSize, offset: 0 })
    setPosts(res.data)
    setNextOffset(res.data.length)
    setHasMore(res.has_more ?? false)
  }, [pageSize])

  const refetch = useCallback(async () => {
    setError(undefined)
    setInitialLoading(true)
    try {
      await fetchInitial()
    } catch (e) {
      setError(e as ErrorResponse)
    } finally {
      setInitialLoading(false)
    }
  }, [fetchInitial])

  useEffect(() => {
    let cancelled = false
    setInitialLoading(true)
    void (async () => {
      try {
        await fetchInitial()
      } catch (e) {
        if (!cancelled) setError(e as ErrorResponse)
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchInitial])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || initialLoading) return
    setLoadingMore(true)
    setError(undefined)
    try {
      const res = await getApiV1Posts({ limit: pageSize, offset: nextOffset })
      setPosts((prev) => [...prev, ...res.data])
      setNextOffset((o) => o + res.data.length)
      setHasMore(res.has_more ?? false)
    } catch (e) {
      setError(e as ErrorResponse)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, initialLoading, nextOffset, pageSize])

  const createPost = useCallback(
    async (body: string, eventIds: number[], todoIds: number[]) => {
      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body,
        posted_at: new Date().toISOString(),
        events: [],
        todos: []
      }
      setPosts((prev) => [optimistic, ...prev])
      try {
        const res = await postApiV1Posts({
          body,
          event_ids: eventIds,
          todo_ids: todoIds
        })
        setPosts((prev) => [res.data, ...prev.filter((p) => p.id > 0)])
      } catch {
        setPosts((prev) => prev.filter((p) => p.id > 0))
      }
    },
    []
  )

  const updatePost = useCallback(async (id: number, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return

    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, body: trimmed } : p))
    )

    try {
      const res = await patchApiV1PostsId(id, { body: trimmed })
      setPosts((prev) => prev.map((p) => (p.id === id ? res.data : p)))
    } catch {
      try {
        await fetchInitial()
      } catch {
        /* ignore */
      }
    }
  }, [fetchInitial])

  const deletePost = useCallback(async (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteApiV1PostsId(id)
    } catch {
      try {
        await fetchInitial()
      } catch {
        /* ignore */
      }
    }
  }, [fetchInitial])

  return {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    loadMore,
    createPost,
    updatePost,
    deletePost,
    refetch
  }
}
