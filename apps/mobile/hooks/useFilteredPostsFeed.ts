import { useMemo } from 'react';
import type { GetApiV1PostsParams } from '@/gen/api/schemas';
import { usePaginatedPostsFeed } from '@/hooks/usePaginatedPostsFeed';

const DEFAULT_PAGE_SIZE = 30;

export type PostsFeedFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'list'; listId: number };

export function buildPostsFeedParams(
  filter: PostsFeedFilter,
  pageSize: number,
  offset: number
): GetApiV1PostsParams {
  const base: GetApiV1PostsParams = { limit: pageSize, offset };
  if (filter.type === 'favorites') return { ...base, favorite: 'true' };
  if (filter.type === 'list') return { ...base, listIds: String(filter.listId) };
  return base;
}

function firstPageParamsForCacheKey(cacheKey: string, pageSize: number): GetApiV1PostsParams {
  if (cacheKey.startsWith('list:')) {
    return {
      limit: pageSize,
      offset: 0,
      listIds: cacheKey.slice('list:'.length),
    };
  }
  if (cacheKey === 'favorites') {
    return { limit: pageSize, offset: 0, favorite: 'true' };
  }
  return { limit: pageSize, offset: 0 };
}

function filterCacheKey(filter: PostsFeedFilter): string {
  if (filter.type === 'list') return `list:${filter.listId}`;
  return filter.type;
}

/** Paginated posts feed with optional favorites / list filters. */
export function useFilteredPostsFeed(
  filter: PostsFeedFilter,
  pageSize = DEFAULT_PAGE_SIZE
): {
  posts: ReturnType<typeof usePaginatedPostsFeed>['posts'];
  hasMore: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  error: ReturnType<typeof usePaginatedPostsFeed>['error'];
  loadMore: () => Promise<void>;
  mutate: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const cacheKey = filterCacheKey(filter);
  const firstPageParams = useMemo(
    () => firstPageParamsForCacheKey(cacheKey, pageSize),
    [cacheKey, pageSize]
  );

  const { posts, hasMore, initialLoading, loadingMore, error, loadMore, refetch } =
    usePaginatedPostsFeed(firstPageParams);

  return {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    loadMore,
    mutate: refetch,
    refresh: refetch,
  };
}

/** Posts in a single user-defined list. */
export function usePostListDetail(listId: number, pageSize = DEFAULT_PAGE_SIZE) {
  return useFilteredPostsFeed({ type: 'list', listId }, pageSize);
}
