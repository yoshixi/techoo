import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/ui/text';
import { usePostsFeed } from '@/hooks/usePostsFeed';
import { TimelinePostsList } from '@/components/posts/TimelinePostsList';
import { FloatingCreateButton } from '@/components/navigation/FloatingCreateButton';

export default function LogbookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { posts, initialLoading, loadingMore, hasMore, loadMore, mutate, refresh } = usePostsFeed();
  const [refreshing, setRefreshing] = useState(false);
  const skipNextFocusRefresh = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefresh.current) {
        skipNextFocusRefresh.current = false;
        return;
      }
      void refresh();
    }, [refresh])
  );

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
      <View className="px-4 pb-2 pt-1">
        <Text className="text-xs text-muted-foreground">
          Simple stream of notes and progress updates
        </Text>
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
      />
      <FloatingCreateButton
        bottomInset={insets.bottom}
        accessibilityLabel="Create post"
        onPress={() =>
          router.push({
            pathname: '/post/new',
            params: { date: new Date().toISOString() },
          })
        }
      />
    </View>
  );
}
