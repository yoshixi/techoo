import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import type { Post } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { usePostLists } from '@/hooks/usePostLists';
import { showApiError } from '@/lib/showApiError';

export function AddPostToListModal({
  post,
  visible,
  onClose,
}: {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { lists, isLoading, createList, togglePostInList } = usePostLists();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyListId, setBusyListId] = useState<number | null>(null);

  const handleCreate = useCallback(async () => {
    if (!post || creating) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const list = await createList(trimmed);
      setNewName('');
      await togglePostInList(post, list.id);
    } catch (err) {
      showApiError(err, 'Couldn’t create list');
    } finally {
      setCreating(false);
    }
  }, [createList, creating, newName, post, togglePostInList]);

  const handleToggle = useCallback(
    async (listId: number) => {
      if (!post || busyListId != null) return;
      setBusyListId(listId);
      try {
        await togglePostInList(post, listId);
      } catch (err) {
        showApiError(err, 'Couldn’t update list');
      } finally {
        setBusyListId(null);
      }
    },
    [busyListId, post, togglePostInList]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[70%] rounded-t-2xl bg-card px-4 pb-8 pt-4"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">Add to list</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={20} className="text-muted-foreground" />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator className="py-6" />
          ) : (
            <ScrollView className="max-h-64">
              {lists.length === 0 ? (
                <Text className="py-3 text-sm text-muted-foreground">No lists yet — create one below.</Text>
              ) : (
                lists.map((list) => {
                  const selected = post?.list_ids.includes(list.id) ?? false;
                  const busy = busyListId === list.id;
                  return (
                    <Pressable
                      key={list.id}
                      onPress={() => void handleToggle(list.id)}
                      disabled={busy}
                      className="mb-1 flex-row items-center justify-between rounded-xl px-3 py-3 active:bg-muted/40"
                    >
                      <Text className="flex-1 text-sm text-foreground">{list.name}</Text>
                      {busy ? (
                        <ActivityIndicator size="small" />
                      ) : selected ? (
                        <Check size={18} className="text-primary" />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}

          <View className="mt-4 flex-row items-center gap-2">
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New list name"
              placeholderTextColor="#9ca3af"
              className="min-h-[44px] flex-1 rounded-xl border border-border/40 bg-background px-3 text-sm text-foreground"
              editable={!creating}
            />
            <Pressable
              onPress={() => void handleCreate()}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}
