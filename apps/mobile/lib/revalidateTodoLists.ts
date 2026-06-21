import { mutate } from 'swr';

const TODOS_LIST_ROUTE = '/api/v1/todos' as const;

/** Refetches every cached todos list (any query params). Used after create/update/delete from screens that don't share the same SWR key as ToDos. */
export function revalidateAllTodoLists(): Promise<unknown> {
  return mutate(
    (key) => Array.isArray(key) && key[0] === TODOS_LIST_ROUTE,
    undefined,
    { revalidate: true }
  );
}
