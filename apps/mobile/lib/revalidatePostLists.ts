import { mutate } from 'swr';

const POSTS_LIST_ROUTE = '/api/v1/posts' as const;

/** Refetches every cached posts list (any query params). Used after create/update/delete from screens that don’t share the same SWR key as Timeline. */
export function revalidateAllPostLists(): Promise<unknown> {
  return mutate(
    (key) => Array.isArray(key) && key[0] === POSTS_LIST_ROUTE,
    undefined,
    { revalidate: true }
  );
}
