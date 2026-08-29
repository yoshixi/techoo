import { useCallback } from 'react';
import { postApiV1Posts, useGetApiV1PostsIdThread } from '@/gen/api/endpoints/techooAPI.gen';
import type { ErrorResponse, Post } from '@/gen/api/schemas';
import { revalidateAllPostFeedCaches } from '@/lib/patchPostCaches';
import { revalidateAllPostLists } from '@/lib/revalidatePostLists';

export function usePostThread(postId: number | null): {
  root: Post | null;
  replies: Post[];
  isLoading: boolean;
  error: ErrorResponse | undefined;
  refresh: () => Promise<void>;
  createReply: (body: string) => Promise<void>;
} {
  const query = useGetApiV1PostsIdThread(postId ?? 0, {
    swr: {
      enabled: postId != null,
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

      await postApiV1Posts({
        body: trimmed,
        parent_post_id: postId,
      });

      await Promise.all([query.mutate(), revalidateAllPostFeedCaches(), revalidateAllPostLists()]);
    },
    [postId, query]
  );

  return {
    root: query.data?.data.root ?? null,
    replies: query.data?.data.replies ?? [],
    isLoading: query.isLoading,
    error: query.error as ErrorResponse | undefined,
    refresh,
    createReply,
  };
}
