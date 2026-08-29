import { useCallback, useMemo } from 'react';
import {
  View,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import type { Post } from '@/gen/api/schemas';
import { groupPostsByLocalDay } from '@/lib/postDayGroups';
import { PostRow } from '@/components/posts/PostRow';

type Section = {
  dayKey: string;
  label: string;
  data: Post[];
};

export function TimelinePostsList({
  posts,
  isLoading,
  loadingMore,
  hasMore,
  refreshing,
  onRefresh,
  onLoadMore,
  bottomInset,
  emptyMessage = 'No posts yet.',
}: {
  posts: Post[];
  isLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  bottomInset: number;
  emptyMessage?: string;
}) {
  const router = useRouter();

  const sections = useMemo((): Section[] => {
    return groupPostsByLocalDay(posts).map((group) => ({
      dayKey: group.dayKey,
      label: group.label,
      data: group.posts,
    }));
  }, [posts]);

  const openPost = useCallback(
    (post: Post) => {
      router.push({
        pathname: '/post/[id]',
        params: { id: String(post.id), postedAt: post.posted_at },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Post>) => (
      <View className="pl-5 pr-4">
        <PostRow post={item} onOpenThread={() => openPost(item)} />
      </View>
    ),
    [openPost]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View className="relative px-4 pb-2 pt-3">
        <View className="absolute left-3 top-[18px] h-2 w-2 rounded-full bg-primary opacity-85" />
        <Text className="pl-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {section.label}
        </Text>
      </View>
    ),
    []
  );

  const ListFooter = useCallback(() => {
    if (loadingMore) {
      return <ActivityIndicator className="py-4" />;
    }
    if (!hasMore && posts.length > 0) {
      return (
        <Text className="py-3 text-center text-[11px] text-muted-foreground">End of log</Text>
      );
    }
    return null;
  }, [loadingMore, hasMore, posts.length]);

  if (isLoading && posts.length === 0) {
    return <ActivityIndicator className="py-8" />;
  }

  if (!isLoading && posts.length === 0) {
    return (
      <Text className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</Text>
    );
  }

  return (
    <SectionList<Post, Section>
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={false}
      onEndReached={() => {
        if (hasMore && !loadingMore) onLoadMore();
      }}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: Math.max(bottomInset + 84, 120) }}
      ListFooterComponent={ListFooter}
    />
  );
}
