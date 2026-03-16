import { useState, useCallback } from 'react';
import { View, Modal, Pressable, FlatList } from 'react-native';
import { Plus, Check, X } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import { useGetApiTags, usePostApiTags, getGetApiTagsKey } from '@/gen/api/endpoints/techoAPI.gen';
import { Text } from '@/components/ui/text';
import { Badge, PressableBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface TagPickerProps {
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
}

export function TagPicker({ selectedTagIds, onTagsChange }: TagPickerProps) {
  const { mutate } = useSWRConfig();
  const { data: tagsData } = useGetApiTags();
  const { trigger: createTag, isMutating: isCreating } = usePostApiTags();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const tags = tagsData?.tags ?? [];
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  const handleToggleTag = useCallback(
    (tagId: number) => {
      const newIds = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId];
      onTagsChange(newIds);
    },
    [selectedTagIds, onTagsChange]
  );

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    try {
      const result = await createTag({ name: newTagName.trim() });
      await mutate(getGetApiTagsKey());
      if (result?.tag) {
        onTagsChange([...selectedTagIds, result.tag.id]);
      }
      setNewTagName('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  }, [newTagName, createTag, mutate, selectedTagIds, onTagsChange]);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} label={tag.name} variant="secondary" />
        ))}
        <Pressable
          onPress={() => setShowPicker(true)}
          className="flex-row items-center gap-1 px-2 py-1 border border-dashed border-border rounded-full"
        >
          <Plus size={14} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">Add tag</Text>
        </Pressable>
      </View>

      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Text className="font-semibold text-lg">Select Tags</Text>
            <Pressable onPress={() => setShowPicker(false)} hitSlop={10}>
              <X size={24} className="text-muted-foreground" />
            </Pressable>
          </View>

          <View className="p-4 border-b border-border">
            <View className="flex-row gap-2">
              <Input
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="New tag name"
                className="flex-1"
              />
              <Button
                onPress={handleCreateTag}
                disabled={!newTagName.trim() || isCreating}
              >
                <Text className="text-primary-foreground">
                  {isCreating ? '...' : 'Add'}
                </Text>
              </Button>
            </View>
          </View>

          <FlatList
            data={tags}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const isSelected = selectedTagIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => handleToggleTag(item.id)}
                  className="flex-row items-center justify-between py-3 px-4 mb-2 bg-muted/30 rounded-lg active:opacity-70"
                >
                  <Text className="font-medium">{item.name}</Text>
                  {isSelected && <Check size={20} className="text-primary" />}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Text className="text-muted-foreground">No tags yet</Text>
                <Text className="text-sm text-muted-foreground mt-1">
                  Create one above
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
