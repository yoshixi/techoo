import { useCallback, useMemo } from 'react';
import {
  useGetApiV1Posts,
  postApiV1Posts,
  deleteApiV1PostsId,
} from '@/gen/api/endpoints/techooAPI.gen';
import type { ErrorResponse, GetApiV1PostsParams, Post } from '@/gen/api/schemas';
import { revalidateAllPostLists } from '@/lib/revalidatePostLists';
import { getPostsFeedSwrKey, POSTS_FEED_SWR_OPTIONS } from '@/lib/postsFeedSwrKey';
import { toRfc3339 } from '@/lib/time';
import { getJournalService, useJournalMode } from '@/lib/journal/runtime';
import { useJournalSnapshot } from '@/hooks/useJournalSnapshot';

function todayBoundaries(): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { from: start, to: endExclusive };
}

export function usePosts(options?: { from: Date; to: Date; limit?: number }): {
  posts: Post[];
  isLoading: boolean;
  error: ErrorResponse | undefined;
  createPost: (
    body: string,
    eventIds: number[],
    todoIds: number[],
    parentPostId?: number
  ) => Promise<void>;
  deletePost: (id: number) => Promise<void>;
  mutate: () => Promise<unknown>;
} {
  const params = useMemo((): GetApiV1PostsParams => {
    const base = options ?? todayBoundaries();
    return {
      from: toRfc3339(base.from),
      to: toRfc3339(base.to),
      ...(options?.limit !== undefined ? { limit: options.limit } : {}),
    };
  }, [options?.from?.getTime(), options?.to?.getTime(), options?.limit]);
  const mode = useJournalMode();
  const local = useJournalSnapshot(
    mode === 'local',
    () => getJournalService().queryPosts({ from: params.from, to: params.to, limit: params.limit }),
    `${params.from}|${params.to}|${params.limit ?? ''}`
  );
  const { data, error, isLoading, mutate } = useGetApiV1Posts(params, {
    swr: {
      swrKey: getPostsFeedSwrKey(params),
      ...POSTS_FEED_SWR_OPTIONS,
      enabled: mode !== 'local',
    },
  });
  const posts: Post[] = mode === 'local' ? (local.data?.posts ?? []) : (data?.data ?? []);

  const createPost = useCallback(
    async (body: string, eventIds: number[], todoIds: number[], parentPostId?: number) => {
      if (mode === 'local') {
        await getJournalService().createPost({
          body,
          todoLocalIds: todoIds,
          events: eventIds.map((id) => ({ id, title: 'Event' })),
          parentLocalId: parentPostId,
        });
        return;
      }
      const nowIso = toRfc3339(new Date());
      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body,
        parent_post_id: parentPostId ?? null,
        posted_at: nowIso,
        events: [],
        todos: [],
        is_favorited: false,
        list_ids: [],
        reply_count: 0,
      };
      mutate(
        (current) => ({
          data: [optimistic, ...(current?.data ?? [])],
        }),
        { revalidate: false }
      );
      try {
        await postApiV1Posts({
          body,
          parent_post_id: parentPostId,
          event_ids: eventIds,
          todo_ids: todoIds,
        });
        await revalidateAllPostLists();
      } catch (err) {
        await revalidateAllPostLists();
        throw err;
      }
    },
    [mode, mutate]
  );

  const deletePost = useCallback(
    async (id: number) => {
      if (mode === 'local') {
        await getJournalService().deletePost(id);
        return;
      }
      try {
        await deleteApiV1PostsId(id);
        await revalidateAllPostLists();
      } catch (err) {
        await revalidateAllPostLists();
        throw err;
      }
    },
    [mode]
  );

  return {
    posts,
    isLoading: mode === 'local' ? local.loading && local.data === undefined : isLoading,
    error: mode === 'local' ? local.error : error,
    createPost,
    deletePost,
    mutate: mode === 'local' ? local.refresh : () => mutate(),
  };
}
