import { useCallback } from 'react';
import {
  useGetApiV1PostLists,
  postApiV1PostLists,
  deleteApiV1PostListsId,
  postApiV1PostListsIdPosts,
  deleteApiV1PostListsIdPostsPostId,
} from '@/gen/api/endpoints/techooAPI.gen';
import type { Post, PostList } from '@/gen/api/schemas';
import { customInstance } from '@/lib/api/mutator';
import {
  patchPostInAllFeedCaches,
  revalidateAllPostFeedCaches,
  revalidatePostCollectionCaches,
} from '@/lib/patchPostCaches';
import { getJournalService, useJournalMode } from '@/lib/journal/runtime';
import { useJournalSnapshot } from '@/hooks/useJournalSnapshot';

export function usePostLists(): {
  lists: PostList[];
  isLoading: boolean;
  createList: (name: string) => Promise<PostList>;
  renameList: (listId: number, name: string) => Promise<PostList>;
  deleteList: (listId: number) => Promise<void>;
  togglePostInList: (post: Post, listId: number) => Promise<void>;
  refreshLists: () => Promise<void>;
} {
  const mode = useJournalMode();
  const local = useJournalSnapshot(
    mode === 'local',
    () => getJournalService().queryLists(),
    'lists'
  );
  const { data, isLoading, mutate } = useGetApiV1PostLists({ swr: { enabled: mode !== 'local' } });
  const lists = mode === 'local' ? (local.data ?? []) : (data?.data ?? []);

  const refreshLists = useCallback(async () => {
    if (mode === 'local') {
      await local.refresh();
      return;
    }
    await mutate();
  }, [mode, local.refresh, mutate]);

  const createList = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('List name is required');
      if (mode === 'local') return getJournalService().createList(trimmed);
      const res = await postApiV1PostLists({ name: trimmed });
      await revalidatePostCollectionCaches();
      return res.data;
    },
    [mode]
  );

  const renameList = useCallback(
    async (listId: number, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('List name is required');
      if (mode === 'local') return getJournalService().renameList(listId, trimmed);
      const res = await customInstance<{ data: PostList }>({
        url: `/api/v1/post-lists/${listId}`,
        method: 'PATCH',
        data: { name: trimmed },
      });
      await mutate();
      return res.data;
    },
    [mode, mutate]
  );

  const deleteList = useCallback(
    async (listId: number) => {
      if (mode === 'local') {
        await getJournalService().deleteList(listId);
        return;
      }
      await deleteApiV1PostListsId(listId);
      await Promise.all([revalidatePostCollectionCaches(), revalidateAllPostFeedCaches()]);
    },
    [mode]
  );

  const togglePostInList = useCallback(
    async (post: Post, listId: number) => {
      if (mode === 'local') {
        await getJournalService().setPostListMembership(
          post.id,
          listId,
          !post.list_ids.includes(listId)
        );
        return;
      }
      const inList = post.list_ids.includes(listId);
      const nextIds = inList
        ? post.list_ids.filter((id) => id !== listId)
        : [...post.list_ids, listId];

      await patchPostInAllFeedCaches(post.id, (current) => ({
        ...current,
        list_ids: nextIds,
      }));

      try {
        if (inList) {
          await deleteApiV1PostListsIdPostsPostId(listId, post.id);
        } else {
          await postApiV1PostListsIdPosts(listId, { post_id: post.id });
        }
        await revalidateAllPostFeedCaches();
      } catch (err) {
        await patchPostInAllFeedCaches(post.id, (current) => ({
          ...current,
          list_ids: post.list_ids,
        }));
        throw err;
      }
    },
    [mode]
  );

  return {
    lists,
    isLoading: mode === 'local' ? local.loading && local.data === undefined : isLoading,
    createList,
    renameList,
    deleteList,
    togglePostInList,
    refreshLists,
  };
}
