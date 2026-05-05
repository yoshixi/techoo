import { useCallback, useState, useMemo } from 'react';
import { View, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import type { Todo } from '@/gen/api/schemas';

export default function TodosScreen() {
  const router = useRouter();
  const { todos, isLoading, toggleDone, mutate } = useTodos({ showAll: true });
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(() => {
    return [...todos].sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done;
      const as = new Date(a.starts_at ?? a.created_at).getTime();
      const bs = new Date(b.starts_at ?? b.created_at).getTime();
      return as - bs;
    });
  }, [todos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  const renderItem = useCallback(
    ({ item }: { item: Todo }) => (
      <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
        <Pressable
          onPress={() =>
            void toggleDone(item.id, item.done).catch(() => {
              /* failure surfaced in customInstance */
            })
          }
          className="h-9 w-9 items-center justify-center rounded-full border border-border"
        >
          {item.done === 1 ? <Check size={18} className="text-green-600" /> : null}
        </Pressable>
        <Pressable onPress={() => router.push(`/todo/${item.id}`)} className="min-w-0 flex-1">
          <Text className={`text-sm ${item.done === 1 ? 'text-muted-foreground line-through' : ''}`}>
            {item.title}
          </Text>
          {item.starts_at != null ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {new Date(item.starts_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : (
            <Text className="mt-0.5 text-xs text-muted-foreground">Unscheduled</Text>
          )}
        </Pressable>
      </View>
    ),
    [router, toggleDone]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-3">
        <Text className="mb-1 text-xl font-semibold">To-do</Text>
        <Text className="mb-3 text-sm text-muted-foreground">Open items across days. Tap to edit.</Text>
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            isLoading ? null : (
              <Text className="py-8 text-center text-sm text-muted-foreground">No open to-dos.</Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </SafeAreaView>
  );
}
