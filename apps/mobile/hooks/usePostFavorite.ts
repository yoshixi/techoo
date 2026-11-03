import { useCallback } from 'react';
import {
  postApiV1PostsIdFavorite,
  deleteApiV1PostsIdFavorite,
} from '@/gen/api/endpoints/techooAPI.gen';
import type { Post } from '@/gen/api/schemas';
import { patchPostInAllFeedCaches, revalidateAllPostFeedCaches } from '@/lib/patchPostCaches';
import { getJournalService, useJournalMode } from '@/lib/journal/runtime';

export function usePostFavorite(): {
  toggleFavorite: (post: Post) => Promise<void>;
} {
  const mode = useJournalMode();
  const toggleFavorite = useCallback(
    async (post: Post) => {
      const next = !post.is_favorited;
      if (mode === 'local') {
        await getJournalService().setPostFavorite(post.id, next);
        return;
      }
      await patchPostInAllFeedCaches(post.id, (current) => ({
        ...current,
        is_favorited: next,
      }));
      try {
        if (next) {
          await postApiV1PostsIdFavorite(post.id);
        } else {
          await deleteApiV1PostsIdFavorite(post.id);
        }
        await revalidateAllPostFeedCaches();
      } catch (err) {
        await patchPostInAllFeedCaches(post.id, (current) => ({
          ...current,
          is_favorited: !next,
        }));
        throw err;
      }
    },
    [mode]
  );

  return { toggleFavorite };
}
