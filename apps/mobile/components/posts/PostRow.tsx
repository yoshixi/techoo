import { View, Pressable, Alert } from 'react-native';
import type { Post } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Trash2 } from 'lucide-react-native';
import { formatTime } from '@/lib/time';

export function PostRow({
  post,
  onDelete,
}: {
  post: Post;
  onDelete: (id: number) => void | Promise<void>;
}) {
  const confirmDelete = () => {
    Alert.alert('Delete post', 'Remove this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void Promise.resolve(onDelete(post.id)).catch(() => {}),
      },
    ]);
  };

  const links =
    [...post.todos.map((t) => t.title), ...post.events.map((e) => e.title)].filter(Boolean);

  return (
    <View className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <View className="mb-1 flex-row items-start justify-between gap-2">
        <Text className="text-xs text-muted-foreground">{formatTime(post.posted_at)}</Text>
        <Pressable onPress={confirmDelete} hitSlop={8}>
          <Trash2 size={16} className="text-muted-foreground" />
        </Pressable>
      </View>
      <Text className="text-sm leading-snug text-foreground">{post.body}</Text>
      {links.length > 0 ? (
        <Text className="mt-2 text-[11px] text-muted-foreground" numberOfLines={2}>
          {links.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
