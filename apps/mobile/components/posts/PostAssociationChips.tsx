import { View } from 'react-native';
import type { Post, PostList } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';

function resolveListEntries(post: Post, lists: PostList[]): PostList[] {
  return post.list_ids
    .map((id) => lists.find((item) => item.id === id))
    .filter((item): item is PostList => item != null);
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5">
      <Text className="text-[11px] font-medium text-muted-foreground">#{label}</Text>
    </View>
  );
}

/** Lists, to-dos, and events on the last line of a post card. */
export function PostAssociationChips({
  post,
  lists,
}: {
  post: Post;
  lists: PostList[];
}) {
  const listEntries = resolveListEntries(post, lists);
  const hasAny = listEntries.length > 0 || post.todos.length > 0 || post.events.length > 0;
  if (!hasAny) return null;

  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5">
      {listEntries.map((list) => (
        <Tag key={`list-${list.id}`} label={list.name} />
      ))}
      {post.todos.map((todo) => (
        <Tag key={`todo-${todo.id}`} label={todo.title} />
      ))}
      {post.events.map((event) => (
        <Tag key={`event-${event.id}`} label={event.title} />
      ))}
    </View>
  );
}
