import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiV1Posts, getGetApiV1PostsKey } from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, GetApiV1PostsParams, Post } from '../gen/api/schemas'

const FEED_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000
} as const

export function usePaginatedPostsFeed(firstPageParams: GetApiV1PostsParams): {
  posts: Post[]
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: ErrorResponse | undefined
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
  prependPost: (post: Post) => void
  patchPost: (id: number, patch: (post: Post) => Post) => void
  removePost: (id: number) => void
} {
  const swrKey = getGetApiV1PostsKey(firstPageParams)
  const paramsCacheKey = JSON.stringify(firstPageParams)

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => getApiV1Posts(firstPageParams),
    FEED_SWR_OPTIONS
  )

  const [extraPosts, setExtraPosts] = useState<Post[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<ErrorResponse | undefined>()

  useEffect(() => {
    setExtraPosts([])
    setLoadMoreError(undefined)
  }, [paramsCacheKey])

  useEffect(() => {
    if (!data) return
    setNextOffset(data.data.length)
    setHasMore(data.has_more ?? false)
  }, [data])

  const posts = useMemo(
    () => [...(data?.data ?? []), ...extraPosts],
    [data?.data, extraPosts]
  )

  const initialLoading = isLoading && posts.length === 0

  const refetch = useCallback(async () => {
    setExtraPosts([])
    setLoadMoreError(undefined)
    await mutate()
  }, [mutate])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || initialLoading) return
    setLoadingMore(true)
    setLoadMoreError(undefined)
    try {
      const res = await getApiV1Posts({ ...firstPageParams, offset: nextOffset })
      setExtraPosts((prev) => [...prev, ...res.data])
      setNextOffset((offset) => offset + res.data.length)
      setHasMore(res.has_more ?? false)
    } catch (e) {
      setHasMore(false)
      setLoadMoreError(e as ErrorResponse)
    } finally {
      setLoadingMore(false)
    }
  }, [firstPageParams, hasMore, loadingMore, initialLoading, nextOffset])

  const prependPost = useCallback(
    (post: Post) => {
      void mutate(
        (current) => {
          if (!current) return { data: [post], has_more: false }
          return { ...current, data: [post, ...current.data] }
        },
        { revalidate: false }
      )
    },
    [mutate]
  )

  const patchPost = useCallback(
    (id: number, patch: (post: Post) => Post) => {
      void mutate(
        (current) => {
          if (!current) return current
          return {
            ...current,
            data: current.data.map((post) => (post.id === id ? patch(post) : post))
          }
        },
        { revalidate: false }
      )
      setExtraPosts((prev) => prev.map((post) => (post.id === id ? patch(post) : post)))
    },
    [mutate]
  )

  const removePost = useCallback(
    (id: number) => {
      void mutate(
        (current) => {
          if (!current) return current
          return { ...current, data: current.data.filter((post) => post.id !== id) }
        },
        { revalidate: false }
      )
      setExtraPosts((prev) => prev.filter((post) => post.id !== id))
    },
    [mutate]
  )

  return {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error: (error as ErrorResponse | undefined) ?? loadMoreError,
    loadMore,
    refetch,
    prependPost,
    patchPost,
    removePost
  }
}

export function postsFeedFilterKey(filter: {
  type: 'all' | 'favorites' | 'list'
  listId?: number
}): string {
  if (filter.type === 'list') return `list:${filter.listId}`
  return filter.type
}
