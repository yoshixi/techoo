import { useMemo, useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { usePosts } from '@/hooks/usePosts';
import { PostRow } from '@/components/posts/PostRow';
import type { Post } from '@/gen/api/schemas';
import { startOfLocalDay } from '@/lib/dayBounds';
import { WeeklyTabHeader } from '@/components/navigation/WeeklyTabHeader';
import { FloatingCreateButton } from '@/components/navigation/FloatingCreateButton';
const RANGE_DAYS = 14;

export default function LogbookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const range = useMemo(() => {
    const endExclusive = new Date(selectedDay);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const from = new Date(selectedDay);
    from.setDate(from.getDate() - (RANGE_DAYS - 1));
    return { from: startOfLocalDay(from), to: endExclusive };
  }, [selectedDay]);

  const { posts, isLoading, deletePost, mutate } = usePosts(range);
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      ),
    [posts]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of sorted) {
      const d = new Date(post.posted_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const current = map.get(key) ?? [];
      current.push(post);
      map.set(key, current);
    }
    return [...map.entries()]
      .sort((a, b) => {
        const [ay, am, ad] = a[0].split('-').map(Number);
        const [by, bm, bd] = b[0].split('-').map(Number);
        return new Date(by, bm, bd).getTime() - new Date(ay, am, ad).getTime();
      })
      .map(([key, list]) => {
        const [y, m, d] = key.split('-').map(Number);
        const day = new Date(y, m, d);
        return { key, day, posts: list };
      });
  }, [sorted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <WeeklyTabHeader title="Timeline" selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      <View className="px-4 pb-2">
        <Text className="text-xs text-muted-foreground">Last {RANGE_DAYS} days, grouped by day</Text>
      </View>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {isLoading ? <Text className="px-4 py-6 text-sm text-muted-foreground">Loading...</Text> : null}
        {!isLoading && grouped.length === 0 ? (
          <Text className="px-4 py-8 text-center text-sm text-muted-foreground">
            No posts in this window.
          </Text>
        ) : null}
        {grouped.map((group) => (
          <View key={group.key} className="mb-2">
            <Text className="px-4 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            {group.posts.map((item) => (
              <View key={item.id} className="px-4">
                <PostRow post={item} onDelete={deletePost} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <FloatingCreateButton
        bottomInset={insets.bottom}
        accessibilityLabel="Create post"
        onPress={() =>
          router.push({
            pathname: '/post/new',
            params: { date: selectedDay.toISOString() },
          })
        }
      />
    </SafeAreaView>
  );
}
