import { useCallback } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import type { Todo } from '@/gen/api/schemas';
import { listEmptyMessage } from '@/lib/todoListFilters';
import type { TodosListFilters } from '@/lib/todosScreenIntent';
import { TodoFilterChips } from '@/components/todos/TodoFilterChips';
import { TodoListRow } from '@/components/todos/TodoListRow';

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
  toggleDone: (id: number, done: number) => Promise<void>;
  onOpenTodo: (todo: Todo) => void;
  bottomInset: number;
}) {
  const renderItem = useCallback(
    ({ item }: { item: Todo }) => (
      <TodoListRow
        todo={item}
        onPress={() => onOpenTodo(item)}
        onToggleDone={() =>
          void toggleDone(item.id, item.done).catch(() => {
            /* surfaced in customInstance */
          })
        }
      />
    ),
    [onOpenTodo, toggleDone]
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
