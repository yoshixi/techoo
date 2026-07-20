import { useCallback, useState } from 'react';
import {
  View,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { usePostLists } from '@/hooks/usePostLists';
import { showApiError } from '@/lib/showApiError';

export default function PostListsIndexScreen() {
  const router = useRouter();
  const { lists, isLoading, createList, deleteList } = usePostLists();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const onCreate = useCallback(async () => {
    if (creating) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const list = await createList(trimmed);
      setNewName('');
      router.replace({ pathname: '/logbook', params: { tab: `list:${list.id}` } });
    } catch (err) {
      showApiError(err, 'Couldn’t create list');
    } finally {
      setCreating(false);
    }
  }, [createList, creating, newName, router]);

  const onDelete = useCallback(
    (listId: number, name: string) => {
      Alert.alert('Delete list', `Remove “${name}” and its saved posts?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteList(listId).catch((err: unknown) => {
              showApiError(err, 'Couldn’t delete list');
            });
          },
        },
      ]);
    },
    [deleteList]
  );

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border/25 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="mb-2 flex-row items-center gap-1 self-start">
          <ChevronLeft size={18} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Back</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Post lists</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          Named collections for organizing log entries
        </Text>
      </View>

      <View className="flex-row items-center gap-2 px-4 py-3">
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New list name"
          placeholderTextColor="#9ca3af"
          className="min-h-[44px] flex-1 rounded-xl border border-border/40 bg-card/70 px-3 text-sm text-foreground"
          editable={!creating}
        />
        <Pressable
          onPress={() => void onCreate()}
          disabled={creating || !newName.trim()}
          className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15"
        >
          {creating ? (
            <ActivityIndicator size="small" />
          ) : (
            <Plus size={20} className="text-primary" />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator className="py-8" />
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
          {lists.length === 0 ? (
            <Text className="py-6 text-center text-sm text-muted-foreground">
              No lists yet. Create one above or from a post.
            </Text>
          ) : (
            lists.map((list) => (
              <View
                key={list.id}
                className="mb-2 flex-row items-center rounded-xl border border-border bg-card"
              >
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/logbook', params: { tab: `list:${list.id}` } })
                  }
                  className="min-w-0 flex-1 flex-row items-center px-4 py-3.5 active:opacity-80"
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-medium text-foreground">{list.name}</Text>
                  </View>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </Pressable>
                <Pressable
                  onPress={() => onDelete(list.id, list.name)}
                  accessibilityLabel={`Delete ${list.name}`}
                  className="px-3 py-3.5"
                >
                  <Trash2 size={18} className="text-destructive/80" />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
