import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import type { Todo } from '@/gen/api/schemas';
import { listEmptyMessage } from '@/lib/todoListFilters';
import type { TodosListFilters } from '@/lib/todosScreenIntent';
import { TodoFilterChips } from '@/components/todos/TodoFilterChips';
import { TodoListRow } from '@/components/todos/TodoListRow';

const COMPLETE_CHECKMARK_MS = 450;

export function TodosListView({
  selectedDay,
  filters,
  onFiltersChange,
  todos,
  isLoading,
  refreshing,
  onRefresh,
  toggleDone,
  onOpenTodo,
  bottomInset,
}: {
  selectedDay: Date;
  filters: TodosListFilters;
  onFiltersChange: (next: TodosListFilters) => void;
  todos: Todo[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  toggleDone: (
    id: number,
    done: number,
    options?: { reinsert?: Todo; undoTitle?: string }
  ) => Promise<void>;
  onOpenTodo: (todo: Todo) => void;
  bottomInset: number;
}) {
  const [completingIds, setCompletingIds] = useState<Set<number>>(() => new Set());
  const completingIdsRef = useRef<Set<number>>(new Set());
  const completeTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = completeTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      completingIdsRef.current.clear();
    };
  }, []);

  const handleToggleDone = useCallback(
    (item: Todo) => {
      if (completingIdsRef.current.has(item.id)) return;

      if (item.done === 1) {
        void toggleDone(item.id, item.done).catch(() => {
          /* surfaced in customInstance */
        });
        return;
      }

      completingIdsRef.current.add(item.id);
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });

      const title = item.title;
      const timer = setTimeout(() => {
        completeTimersRef.current.delete(item.id);
        completingIdsRef.current.delete(item.id);
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        void toggleDone(item.id, item.done, { undoTitle: title }).catch(() => {
          /* surfaced in customInstance */
        });
      }, COMPLETE_CHECKMARK_MS);

      completeTimersRef.current.set(item.id, timer);
    },
    [toggleDone]
  );

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => (
      <TodoListRow
        todo={item}
        completing={completingIds.has(item.id)}
        onPress={() => onOpenTodo(item)}
        onToggleDone={() => handleToggleDone(item)}
      />
    ),
    [completingIds, handleToggleDone, onOpenTodo]
  );

  return (
    <View className="flex-1">
      <TodoFilterChips filters={filters} onChange={onFiltersChange} />
      {isLoading && todos.length === 0 ? (
        <ActivityIndicator className="py-8" />
      ) : (
        <FlatList
          className="flex-1 px-4"
          data={todos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{
            paddingBottom: Math.max(bottomInset + 84, 120),
            flexGrow: todos.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={
            !isLoading ? (
              <Text className="py-8 text-center text-sm text-muted-foreground">
                {listEmptyMessage(filters, selectedDay)}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
