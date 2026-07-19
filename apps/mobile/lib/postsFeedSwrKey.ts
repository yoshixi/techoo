import type { GetApiV1PostsParams } from '@/gen/api/schemas';

const POSTS_ROUTE = '/api/v1/posts' as const;

/** Stable SWR cache key — avoids refetch loops from object identity in keys. */
export function getPostsFeedSwrKey(params?: GetApiV1PostsParams): readonly [typeof POSTS_ROUTE, string] {
  if (!params || Object.keys(params).length === 0) {
    return [POSTS_ROUTE, '{}'];
  }
  const normalized = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = params[key as keyof GetApiV1PostsParams];
      return acc;
    }, {});
  return [POSTS_ROUTE, JSON.stringify(normalized)];
}

export const POSTS_FEED_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 10_000,
  shouldRetryOnError: false,
  errorRetryCount: 0,
} as const;
