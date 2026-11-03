import { useCallback } from 'react';
import {
  deleteApiV1PostsId,
  patchApiV1PostsId,
  postApiV1Posts,
  useGetApiV1PostsIdThread,
} from '@/gen/api/endpoints/techooAPI.gen';
import type { ErrorResponse, Post } from '@/gen/api/schemas';
import { revalidateAllPostFeedCaches } from '@/lib/patchPostCaches';
import { revalidateAllPostLists } from '@/lib/revalidatePostLists';
import { getJournalService, useJournalMode } from '@/lib/journal/runtime';
import { useJournalSnapshot } from '@/hooks/useJournalSnapshot';

export function usePostThread(postId: number | null): {
  root: Post | null;
  replies: Post[];
  isLoading: boolean;
  error: ErrorResponse | undefined;
  refresh: () => Promise<void>;
  createReply: (body: string) => Promise<void>;
  updatePost: (id: number, body: string) => Promise<void>;
  deletePost: (id: number) => Promise<void>;
} {
  const mode = useJournalMode();
  const local = useJournalSnapshot(
    mode === 'local' && postId != null,
    async () => (postId == null ? null : getJournalService().getThread(postId)),
    String(postId ?? '')
  );
  const query = useGetApiV1PostsIdThread(postId ?? 0, {
    swr: {
      enabled: postId != null && mode !== 'local',
      revalidateOnFocus: false,
    },
  });

  const refresh = useCallback(async () => {
    await query.mutate();
  }, [query]);

  const createReply = useCallback(
    async (body: string) => {
      if (postId == null) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      if (mode === 'local') {
        await getJournalService().createPost({ body: trimmed, parentLocalId: postId });
        return;
      }

      await postApiV1Posts({
        body: trimmed,
        parent_post_id: postId,
      });

      await Promise.all([query.mutate(), revalidateAllPostFeedCaches(), revalidateAllPostLists()]);
    },
    [postId, query, mode]
  );

  const updatePost = useCallback(
    async (id: number, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      if (mode === 'local') {
        await getJournalService().updatePostBody(id, trimmed);
        return;
      }
      await patchApiV1PostsId(id, { body: trimmed });
      await Promise.all([query.mutate(), revalidateAllPostFeedCaches(), revalidateAllPostLists()]);
    },
    [query, mode]
  );

  const deletePost = useCallback(
    async (id: number) => {
      if (mode === 'local') {
        await getJournalService().deletePost(id);
        return;
      }
      await deleteApiV1PostsId(id);
      await Promise.all([query.mutate(), revalidateAllPostFeedCaches(), revalidateAllPostLists()]);
    },
    [query, mode]
  );

  if (mode === 'local') {
    return {
      root: local.data?.root ?? null,
      replies: local.data?.replies ?? [],
      isLoading: local.loading && local.data === undefined,
      error: local.error,
      refresh: local.refresh,
      createReply,
      updatePost,
      deletePost,
    };
  }

  return {
    root: query.data?.data.root ?? null,
    replies: query.data?.data.replies ?? [],
    isLoading: query.isLoading,
    error: query.error as ErrorResponse | undefined,
    refresh,
    createReply,
    updatePost,
    deletePost,
  };
}
