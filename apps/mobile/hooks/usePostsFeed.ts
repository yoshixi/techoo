import { useCallback, useEffect, useState } from 'react'
import { getApiV1Posts } from '@/gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, Post } from '@/gen/api/schemas'

const DEFAULT_PAGE_SIZE = 30

/** All posts newest-first with offset pagination (Timeline tab). */
export function usePostsFeed(pageSize = DEFAULT_PAGE_SIZE): {
  posts: Post[]
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: ErrorResponse | undefined
  loadMore: () => Promise<void>
  mutate: () => Promise<void>
  refresh: () => Promise<void>
} {
  const [posts, setPosts] = useState<Post[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ErrorResponse | undefined>()

  const fetchInitial = useCallback(async () => {
    const res = await getApiV1Posts({ limit: pageSize, offset: 0 })
    setPosts(res.data)
    setNextOffset(res.data.length)
    setHasMore(res.has_more ?? false)
  }, [pageSize])

  const refresh = useCallback(async () => {
    setError(undefined)
    try {
      await fetchInitial()
    } catch (e) {
      setHasMore(false)
      setError(e as ErrorResponse)
    }
  }, [fetchInitial])

  const mutate = useCallback(async () => {
    setError(undefined)
    setInitialLoading(true)
    try {
      await fetchInitial()
    } catch (e) {
      setHasMore(false)
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
        if (!cancelled) {
          setHasMore(false)
          setError(e as ErrorResponse)
        }
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
      setHasMore(false)
      setError(e as ErrorResponse)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, initialLoading, nextOffset, pageSize])

  return {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    loadMore,
    mutate,
    refresh,
  }
}
