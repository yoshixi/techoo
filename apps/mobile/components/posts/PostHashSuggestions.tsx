import { FlatList, Pressable, View } from 'react-native';
import { Hash, List as ListIcon, Star } from 'lucide-react-native';
import type { PostList, Todo } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import type { PostComposerAssociations } from '@/lib/postComposerAssociations';

export type HashSuggestion =
  | { kind: 'favorite'; key: 'favorite'; label: string }
  | { kind: 'list'; key: string; list: { id: number; name: string } }
  | { kind: 'todo'; key: string; todo: Todo };

export function getHashQuery(body: string, cursor: number): { active: boolean; start: number; query: string } {
  const before = body.slice(0, cursor);
  const lastHash = before.lastIndexOf('#');
  if (lastHash === -1) return { active: false, start: 0, query: '' };
  const afterHash = before.slice(lastHash + 1);
  if (afterHash.includes(' ') || afterHash.includes('\n')) return { active: false, start: 0, query: '' };
  return { active: true, start: lastHash, query: afterHash.toLowerCase() };
}

export function buildHashSuggestions(
  query: string,
  associations: PostComposerAssociations,
  lists: PostList[],
  todos: Todo[]
): HashSuggestion[] {
  const q = query.trim().toLowerCase();
  const items: HashSuggestion[] = [];

  if (!associations.favorite && (!q || 'favorites'.includes(q) || 'favorite'.includes(q))) {
    items.push({ kind: 'favorite', key: 'favorite', label: 'Favorites' });
  }

  for (const list of lists) {
    if (associations.lists.some((item) => item.id === list.id)) continue;
    if (q && !list.name.toLowerCase().includes(q)) continue;
    items.push({ kind: 'list', key: `list:${list.id}`, list: { id: list.id, name: list.name } });
  }

  for (const todo of todos) {
    if (q && !todo.title.toLowerCase().includes(q)) continue;
    items.push({ kind: 'todo', key: `todo:${todo.id}`, todo });
  }

  return items;
}

export function PostHashSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: HashSuggestion[];
  onSelect: (item: HashSuggestion) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <View className="mb-2 flex-row items-center gap-2 rounded-xl border border-border/40 bg-card/80 px-3 py-3">
        <Hash size={16} className="text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">No matching to-dos, lists, or favorites</Text>
      </View>
    );
  }

  return (
    <View className="mb-2 max-h-44 overflow-hidden rounded-xl border border-border/40 bg-card/95">
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={suggestions}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            className="flex-row items-center gap-2 border-b border-border/20 px-3 py-2.5 active:bg-muted/40"
          >
            {item.kind === 'favorite' ? (
              <Star size={14} className="text-foreground" />
            ) : item.kind === 'list' ? (
              <ListIcon size={14} className="text-muted-foreground" />
            ) : (
              <Hash size={14} className="text-muted-foreground" />
            )}
            <Text className="min-w-0 flex-1 text-sm text-foreground" numberOfLines={1}>
              {item.kind === 'favorite'
                ? item.label
                : item.kind === 'list'
                  ? item.list.name
                  : item.todo.title}
            </Text>
            <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.kind === 'favorite' ? 'Favorite' : item.kind === 'list' ? 'List' : 'To-do'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

export function applyHashSuggestion(
  associations: PostComposerAssociations,
  item: HashSuggestion
): PostComposerAssociations {
  if (item.kind === 'favorite') return { ...associations, favorite: true };
  if (item.kind === 'list') {
    if (associations.lists.some((entry) => entry.id === item.list.id)) return associations;
    return { ...associations, lists: [...associations.lists, item.list] };
  }
  return {
    ...associations,
    todo: { id: item.todo.id, title: item.todo.title },
  };
}

export function removeHashToken(body: string, hashStart: number, cursor: number): string {
  return body.slice(0, hashStart) + body.slice(cursor);
}
