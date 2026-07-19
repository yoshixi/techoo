import { useMemo } from 'react'
import type { GetApiV1PostsParams } from '../gen/api/schemas'
import { usePaginatedPostsFeed } from './usePaginatedPostsFeed'

const DEFAULT_PAGE_SIZE = 30

export type PostsFeedFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'list'; listId: number }

export function buildPostsFeedParams(
  filter: PostsFeedFilter,
  pageSize: number,
  offset: number
): GetApiV1PostsParams {
  const base: GetApiV1PostsParams = { limit: pageSize, offset }
  if (filter.type === 'favorites') return { ...base, favorite: 'true' }
  if (filter.type === 'list') return { ...base, listIds: String(filter.listId) }
  return base
}

export function useFilteredPostsFeed(
  filter: PostsFeedFilter,
  pageSize = DEFAULT_PAGE_SIZE
): ReturnType<typeof usePaginatedPostsFeed> {
  const firstPageParams = useMemo(
    () => buildPostsFeedParams(filter, pageSize, 0),
    [filter, pageSize]
  )

  return usePaginatedPostsFeed(firstPageParams)
}

export function usePostListDetail(listId: number, pageSize = DEFAULT_PAGE_SIZE) {
  return useFilteredPostsFeed({ type: 'list', listId }, pageSize)
}
