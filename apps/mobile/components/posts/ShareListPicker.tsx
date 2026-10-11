import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import type { PostList } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';

export function ShareListPicker({
  lists,
  isLoading,
  selectedListId,
  onSelect,
  onCreateList,
  creating,
}: {
  lists: PostList[];
  isLoading: boolean;
  selectedListId: number | null;
  onSelect: (listId: number | null) => void;
  onCreateList: (name: string) => Promise<void>;
  creating: boolean;
}) {
  const [newName, setNewName] = useState('');

  const submitNewList = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    void onCreateList(trimmed)
      .then(() => setNewName(''))
      .catch(() => {
        // The screen already surfaces the API error.
      });
  }, [creating, newName, onCreateList]);

  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs text-muted-foreground">List (optional)</Text>
      <Text className="mb-2 text-xs text-muted-foreground">
        The post always goes on your timeline. Choose a list to file it there too.
      </Text>

      {isLoading ? (
        <ActivityIndicator className="py-3" />
      ) : (
        <View className="overflow-hidden rounded-xl border border-border/40 bg-card/70">
          <ListChoice
            label="Timeline only"
            selected={selectedListId == null}
            onPress={() => onSelect(null)}
          />
          {lists.map((list) => (
            <ListChoice
              key={list.id}
              label={list.name}
              selected={selectedListId === list.id}
              onPress={() => onSelect(selectedListId === list.id ? null : list.id)}
            />
          ))}
        </View>
      )}

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New list name"
          placeholderTextColor="#9ca3af"
          className="min-h-[44px] flex-1 rounded-xl border border-border/40 bg-card/70 px-3 text-sm text-foreground"
          editable={!creating}
          onSubmitEditing={submitNewList}
        />
        <Pressable
          onPress={submitNewList}
          disabled={creating || !newName.trim()}
          accessibilityLabel="Create list"
          className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          {creating ? (
            <ActivityIndicator size="small" />
          ) : (
            <Plus size={20} className="text-primary" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ListChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="flex-row items-center justify-between border-b border-border/20 px-3 py-3 active:bg-muted/40">
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
      {selected ? <Check size={18} className="text-primary" /> : null}
    </Pressable>
  );
}
