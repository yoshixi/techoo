import { mutate } from 'swr'
import type { Post } from '../gen/api/schemas'

const POSTS_LIST_ROUTE = '/api/v1/posts' as const
const POST_LISTS_ROUTE = '/api/v1/post-lists' as const

export function revalidateAllPostFeedCaches(): Promise<unknown> {
  return mutate(
    (key) => Array.isArray(key) && key[0] === POSTS_LIST_ROUTE,
    undefined,
    { revalidate: true }
  )
}

export function revalidatePostCollectionCaches(): Promise<unknown> {
  return mutate(
    (key) => Array.isArray(key) && key[0] === POST_LISTS_ROUTE,
    undefined,
    { revalidate: true }
  )
}

export function patchPostInAllFeedCaches(
  postId: number,
  patch: (post: Post) => Post
): Promise<unknown> {
  return mutate(
    (key) => Array.isArray(key) && key[0] === POSTS_LIST_ROUTE,
    (current: { data?: Post[]; has_more?: boolean } | undefined) => {
      if (!current?.data) return current
      return {
        ...current,
        data: current.data.map((post) => (post.id === postId ? patch(post) : post))
      }
    },
    { revalidate: false }
  )
}
