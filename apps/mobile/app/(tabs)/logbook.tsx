import { useMemo, useCallback, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { usePosts } from '@/hooks/usePosts';
import { PostRow } from '@/components/posts/PostRow';
import type { Post } from '@/gen/api/schemas';
const RANGE_DAYS = 14;

export default function LogbookScreen() {
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - RANGE_DAYS * 86400_000);
    return { from: start, to: end };
  }, []);

  const { posts, isLoading, deletePost, mutate } = usePosts(range);
  const [refreshing, setRefreshing] = useState(false);

  const data = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      ),
    [posts]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <View className="px-4">
        <PostRow post={item} onDelete={deletePost} />
      </View>
    ),
    [deletePost]
  );

  const ListHeaderComponent = useMemo(
    () => (
      <View className="px-4 pb-2">
        <Text className="text-xs text-muted-foreground">
          Last {RANGE_DAYS} days · Newest first
        </Text>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-1 pt-3">
        <Text className="px-4 text-xl font-semibold">Logbook</Text>
        <Text className="mb-3 px-4 text-sm text-muted-foreground">
          Posts from your log, newest first. Today’s capture lives on Today → Log.
        </Text>
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            isLoading ? null : (
              <Text className="px-4 py-8 text-center text-sm text-muted-foreground">
                No posts in this window.
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </SafeAreaView>
  );
}
