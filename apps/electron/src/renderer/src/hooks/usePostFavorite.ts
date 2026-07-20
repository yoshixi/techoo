import { useCallback } from 'react'
import {
  postApiV1PostsIdFavorite,
  deleteApiV1PostsIdFavorite
} from '../gen/api/endpoints/techooAPI.gen'
import type { Post } from '../gen/api/schemas'
import { patchPostInAllFeedCaches } from '../lib/patch-post-caches'

export function usePostFavorite(): {
  toggleFavorite: (post: Post) => Promise<void>
} {
  const toggleFavorite = useCallback(async (post: Post) => {
    const next = !post.is_favorited
    await patchPostInAllFeedCaches(post.id, (current) => ({
      ...current,
      is_favorited: next
    }))
    try {
      if (next) {
        await postApiV1PostsIdFavorite(post.id)
      } else {
        await deleteApiV1PostsIdFavorite(post.id)
      }
    } catch (err) {
      await patchPostInAllFeedCaches(post.id, (current) => ({
        ...current,
        is_favorited: !next
      }))
      throw err
    }
  }, [])

  return { toggleFavorite }
}
