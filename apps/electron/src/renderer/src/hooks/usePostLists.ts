import { useCallback } from 'react'
import {
  useGetApiV1PostLists,
  postApiV1PostLists,
  deleteApiV1PostListsId,
  postApiV1PostListsIdPosts,
  deleteApiV1PostListsIdPostsPostId
} from '../gen/api/endpoints/techooAPI.gen'
import { customInstance } from '../lib/api/mutator'
import type { Post, PostList } from '../gen/api/schemas'
import {
  patchPostInAllFeedCaches,
  revalidateAllPostFeedCaches,
  revalidatePostCollectionCaches
} from '../lib/patch-post-caches'

export function usePostLists(): {
  lists: PostList[]
  isLoading: boolean
  createList: (name: string) => Promise<PostList>
  renameList: (listId: number, name: string) => Promise<PostList>
  deleteList: (listId: number) => Promise<void>
  togglePostInList: (post: Post, listId: number) => Promise<void>
  addPostToList: (postId: number, listId: number) => Promise<void>
  refreshLists: () => Promise<void>
} {
  const { data, isLoading, mutate } = useGetApiV1PostLists()
  const lists = data?.data ?? []

  const refreshLists = useCallback(async () => {
    await mutate()
  }, [mutate])

  const createList = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('List name is required')
    const res = await postApiV1PostLists({ name: trimmed })
    await revalidatePostCollectionCaches()
    return res.data
  }, [])

  const renameList = useCallback(
    async (listId: number, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('List name is required')
      const res = await customInstance<{ data: PostList }>({
        url: `/api/v1/post-lists/${listId}`,
        method: 'PATCH',
        data: { name: trimmed }
      })
      await mutate()
      return res.data
    },
    [mutate]
  )

  const deleteList = useCallback(async (listId: number) => {
    await deleteApiV1PostListsId(listId)
    await Promise.all([revalidatePostCollectionCaches(), revalidateAllPostFeedCaches()])
  }, [])

  const togglePostInList = useCallback(async (post: Post, listId: number) => {
    const inList = post.list_ids.includes(listId)
    const nextIds = inList
      ? post.list_ids.filter((id) => id !== listId)
      : [...post.list_ids, listId]

    await patchPostInAllFeedCaches(post.id, (current) => ({
      ...current,
      list_ids: nextIds
    }))

    try {
      if (inList) {
        await deleteApiV1PostListsIdPostsPostId(listId, post.id)
      } else {
        await postApiV1PostListsIdPosts(listId, { post_id: post.id })
      }
    } catch (err) {
      await patchPostInAllFeedCaches(post.id, (current) => ({
        ...current,
        list_ids: post.list_ids
      }))
      throw err
    }
  }, [])

  const addPostToList = useCallback(async (postId: number, listId: number) => {
    await postApiV1PostListsIdPosts(listId, { post_id: postId })
    await revalidateAllPostFeedCaches()
  }, [])

  return {
    lists,
    isLoading,
    createList,
    renameList,
    deleteList,
    togglePostInList,
    addPostToList,
    refreshLists
  }
}
