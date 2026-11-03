import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiV1Posts } from '@/gen/api/endpoints/techooAPI.gen';
import type { ErrorResponse, GetApiV1PostsParams, Post } from '@/gen/api/schemas';
import { getPostsFeedSwrKey, POSTS_FEED_SWR_OPTIONS } from '@/lib/postsFeedSwrKey';
import { getJournalService, useJournalMode } from '@/lib/journal/runtime';
import { useJournalSnapshot } from '@/hooks/useJournalSnapshot';

export function usePaginatedPostsFeed(firstPageParams: GetApiV1PostsParams): {
  posts: Post[];
  hasMore: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  error: ErrorResponse | undefined;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  prependPost: (post: Post) => void;
  patchPost: (id: number, patch: (post: Post) => Post) => void;
  removePost: (id: number) => void;
} {
  const swrKey = getPostsFeedSwrKey(firstPageParams);
  const paramsCacheKey = swrKey[1];
  const mode = useJournalMode();
  const pageSize = firstPageParams.limit ?? 30;
  const [localLimit, setLocalLimit] = useState(pageSize);
  const listIds = firstPageParams.listIds
    ?.split(',')
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));
  const local = useJournalSnapshot(
    mode === 'local',
    () =>
      getJournalService().queryPosts({
        from: firstPageParams.from,
        to: firstPageParams.to,
        favorite: firstPageParams.favorite === 'true',
        listLocalIds: listIds,
        limit: localLimit,
        offset: 0,
      }),
    JSON.stringify({ params: firstPageParams, localLimit })
  );

  const { data, error, isLoading, mutate } = useSWR(
    mode === 'local' ? null : swrKey,
    () => getApiV1Posts(firstPageParams),
    POSTS_FEED_SWR_OPTIONS
  );

  const [extraPosts, setExtraPosts] = useState<Post[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [remoteHasMore, setRemoteHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<ErrorResponse | undefined>();

  useEffect(() => {
    setExtraPosts([]);
    setLoadMoreError(undefined);
  }, [paramsCacheKey]);

  useEffect(() => {
    if (!data) return;
    setNextOffset(data.data.length);
    setRemoteHasMore(data.has_more ?? false);
  }, [data]);

  useEffect(() => {
    setLocalLimit(pageSize);
  }, [paramsCacheKey, pageSize]);

  const posts = useMemo(() => {
    if (mode === 'local') return local.data?.posts ?? [];
    return [...(data?.data ?? []), ...extraPosts];
  }, [mode, local.data?.posts, data?.data, extraPosts]);

  const visibleHasMore = mode === 'local' ? (local.data?.hasMore ?? false) : remoteHasMore;

  const initialLoading =
    mode === 'local' ? local.loading && local.data === undefined : isLoading && posts.length === 0;

  const refetch = useCallback(async () => {
    if (mode === 'local') {
      setLocalLimit(pageSize);
      await local.refresh();
      return;
    }
    setExtraPosts([]);
    setLoadMoreError(undefined);
    await mutate();
  }, [mode, local.refresh, mutate, pageSize]);

  const loadMore = useCallback(async () => {
    if (!visibleHasMore || loadingMore || initialLoading) return;
    if (mode === 'local') {
      setLocalLimit((current) => current + pageSize);
      return;
    }
    setLoadingMore(true);
    setLoadMoreError(undefined);
    try {
      const res = await getApiV1Posts({ ...firstPageParams, offset: nextOffset });
      setExtraPosts((prev) => [...prev, ...res.data]);
      setNextOffset((offset) => offset + res.data.length);
      setRemoteHasMore(res.has_more ?? false);
    } catch (e) {
      setRemoteHasMore(false);
      setLoadMoreError(e as ErrorResponse);
    } finally {
      setLoadingMore(false);
    }
  }, [firstPageParams, visibleHasMore, loadingMore, initialLoading, nextOffset, mode, pageSize]);

  const prependPost = useCallback(
    (post: Post) => {
      void mutate(
        (current) => {
          if (!current) return { data: [post], has_more: false };
          return { ...current, data: [post, ...current.data] };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const patchPost = useCallback(
    (id: number, patch: (post: Post) => Post) => {
      void mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            data: current.data.map((post) => (post.id === id ? patch(post) : post)),
          };
        },
        { revalidate: false }
      );
      setExtraPosts((prev) => prev.map((post) => (post.id === id ? patch(post) : post)));
    },
    [mutate]
  );

  const removePost = useCallback(
    (id: number) => {
      void mutate(
        (current) => {
          if (!current) return current;
          return { ...current, data: current.data.filter((post) => post.id !== id) };
        },
        { revalidate: false }
      );
      setExtraPosts((prev) => prev.filter((post) => post.id !== id));
    },
    [mutate]
  );

  return {
    posts,
    hasMore: visibleHasMore,
    initialLoading,
    loadingMore,
    error: mode === 'local' ? local.error : ((error as ErrorResponse | undefined) ?? loadMoreError),
    loadMore,
    refetch,
    prependPost,
    patchPost,
    removePost,
  };
}
