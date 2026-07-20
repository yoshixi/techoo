import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import {
  useFilteredPostsFeed,
  type PostsFeedFilter,
} from '@/hooks/useFilteredPostsFeed';
import { TimelinePostsList } from '@/components/posts/TimelinePostsList';

export function PostCollectionFeedScreen({
  title,
  subtitle,
  filter,
  emptyMessage,
  showBack = true,
}: {
  title: string;
  subtitle: string;
  filter: PostsFeedFilter;
  emptyMessage: string;
  showBack?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { posts, initialLoading, loadingMore, hasMore, loadMore, mutate } =
    useFilteredPostsFeed(filter);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border/25 px-4 pb-3 pt-2">
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            className="mb-2 flex-row items-center gap-1 self-start"
          >
            <ChevronLeft size={18} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Back</Text>
          </Pressable>
        ) : null}
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
      </View>
      <TimelinePostsList
        posts={posts}
        isLoading={initialLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onLoadMore={() => void loadMore()}
        bottomInset={insets.bottom}
        emptyMessage={emptyMessage}
      />
    </View>
  );
}
