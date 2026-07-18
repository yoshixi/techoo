import { Pressable, View } from 'react-native';
import type { Post } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { LinkifiedText } from '@/components/ui/LinkifiedText';
import { formatTime } from '@/lib/time';

export function PostRow({
  post,
  onPress,
}: {
  post: Post;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="mb-3 rounded-xl bg-card/60 px-3 py-3 active:opacity-85">
      <View className="mb-1 flex-row items-start justify-between gap-2">
        <Text className="text-xs text-muted-foreground">{formatTime(post.posted_at)}</Text>
      </View>
      <LinkifiedText text={post.body} className="text-sm leading-snug text-foreground" />
      {post.todos.length > 0 ? (
        <View className="mt-2 gap-1.5">
          <Text className="text-[11px] font-medium text-muted-foreground">Linked ToDo</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {post.todos.map((todo) => (
              <View
                key={todo.id}
                className="min-h-[32px] justify-center rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-1"
              >
                <Text className="text-xs font-semibold text-primary">{todo.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
