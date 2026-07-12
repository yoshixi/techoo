import { mutate } from 'swr';
import type { Todo } from '@/gen/api/schemas';

export const TODOS_LIST_ROUTE = '/api/v1/todos' as const;

export type TodoListCache = { data: Todo[] };

function isTodosListKey(key: unknown): key is [string, ...unknown[]] {
  return Array.isArray(key) && key[0] === TODOS_LIST_ROUTE;
}

/** Open-only lists use `done: 'false'` in the SWR cache key tuple. */
export function isOpenOnlyTodosKey(key: unknown): boolean {
  return isTodosListKey(key) && key[3] === 'false';
}

/** Refetches every cached todos list (any query params). */
export function revalidateAllTodoLists(): Promise<unknown> {
  return mutate(
    (key) => isTodosListKey(key),
    undefined,
    { revalidate: true }
  );
}

export function applyToggleDoneToCache(
  current: TodoListCache | undefined,
  key: unknown,
  id: number,
  newDone: number,
  nowIso: string,
  reinsert?: Todo
): TodoListCache | undefined {
  if (!current) return current;

  const openOnly = isOpenOnlyTodosKey(key);

  if (newDone === 1 && openOnly) {
    return { data: current.data.filter((t) => t.id !== id) };
  }

  const exists = current.data.some((t) => t.id === id);

  if (newDone === 0 && openOnly && !exists && reinsert) {
    return {
      data: [...current.data, { ...reinsert, done: 0, done_at: null }],
    };
  }

  if (!exists && newDone === 0 && reinsert) {
    return { data: [...current.data, { ...reinsert, done: 0, done_at: null }] };
  }

  return {
    data: current.data.map((t) =>
      t.id === id ? { ...t, done: newDone, done_at: newDone === 1 ? nowIso : null } : t
    ),
  };
}

export function mergeTodoInCache(
  current: TodoListCache | undefined,
  key: unknown,
  id: number,
  server: Todo
): TodoListCache | undefined {
  if (!current) return current;

  const openOnly = isOpenOnlyTodosKey(key);
  if (openOnly && server.done === 1) {
    return { data: current.data.filter((t) => t.id !== id) };
  }

  const exists = current.data.some((t) => t.id === id);
  if (!exists) {
    if (openOnly && server.done === 1) return current;
    return { data: [...current.data, server] };
  }

  return {
    data: current.data.map((t) => (t.id === id ? server : t)),
  };
}
