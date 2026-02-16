import { View, Modal, Pressable, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { useGetApiTags } from '@/gen/api/endpoints/shuchuAPI.gen';
import { Text } from '@/components/ui/text';
import { Switch } from '@/components/ui/switch';
import { PressableBadge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { FilterState, SortState } from './TaskFilters';

const SORT_OPTIONS: { value: SortState['sortBy']; label: string }[] = [
  { value: 'startAt', label: 'Start Date' },
  { value: 'createdAt', label: 'Created' },
  { value: 'dueDate', label: 'Due Date' },
];

const ORDER_OPTIONS: { value: SortState['order']; label: string }[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  sort: SortState;
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortState) => void;
}

export function FilterSheet({
  visible,
  onClose,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
}: FilterSheetProps) {
  const { data: tagsData } = useGetApiTags();
  const tags = tagsData?.tags ?? [];

  const handleToggleCompleted = () => {
    onFiltersChange({ ...filters, showCompleted: !filters.showCompleted });
  };

  const handleToggleTag = (tagId: string) => {
    const newSelectedTagIds = filters.selectedTagIds.includes(tagId)
      ? filters.selectedTagIds.filter((id) => id !== tagId)
      : [...filters.selectedTagIds, tagId];
    onFiltersChange({ ...filters, selectedTagIds: newSelectedTagIds });
  };

  const handleSortByChange = (sortBy: SortState['sortBy']) => {
    onSortChange({ ...sort, sortBy });
  };

  const handleOrderChange = (order: SortState['order']) => {
    onSortChange({ ...sort, order });
  };

  const handleReset = () => {
    onFiltersChange({ showCompleted: false, selectedTagIds: [] });
    onSortChange({ sortBy: 'startAt', order: 'asc' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} className="text-muted-foreground" />
          </Pressable>
          <Text className="font-semibold text-lg">Filters & Sort</Text>
          <Pressable onPress={handleReset} hitSlop={10}>
            <Text className="text-sm text-primary">Reset</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Filters Section */}
          <Text className="text-sm font-medium text-muted-foreground mb-3">FILTERS</Text>

          <View className="flex-row items-center justify-between py-3">
            <Text className="text-base">Show completed tasks</Text>
            <Switch
              checked={filters.showCompleted}
              onCheckedChange={handleToggleCompleted}
            />
          </View>

          {tags.length > 0 && (
            <View className="py-3">
              <Text className="text-base mb-3">Filter by tags</Text>
              <View className="flex-row flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = filters.selectedTagIds.includes(tag.id);
                  return (
                    <PressableBadge
                      key={tag.id}
                      label={tag.name}
                      variant={isSelected ? 'default' : 'outline'}
                      onPress={() => handleToggleTag(tag.id)}
                    />
                  );
                })}
              </View>
            </View>
          )}

          <Separator className="my-4" />

          {/* Sort Section */}
          <Text className="text-sm font-medium text-muted-foreground mb-3">SORT BY</Text>

          <View className="gap-1">
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleSortByChange(option.value)}
                className="flex-row items-center justify-between py-3"
              >
                <Text className="text-base">{option.label}</Text>
                {sort.sortBy === option.value && (
                  <Check size={20} className="text-primary" />
                )}
              </Pressable>
            ))}
          </View>

          <Separator className="my-4" />

          {/* Order Section */}
          <Text className="text-sm font-medium text-muted-foreground mb-3">ORDER</Text>

          <View className="gap-1">
            {ORDER_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleOrderChange(option.value)}
                className="flex-row items-center justify-between py-3"
              >
                <Text className="text-base">{option.label}</Text>
                {sort.order === option.value && (
                  <Check size={20} className="text-primary" />
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Done Button */}
        <View className="p-4 border-t border-border">
          <Pressable
            onPress={onClose}
            className="bg-primary py-3 rounded-lg items-center"
          >
            <Text className="text-primary-foreground font-medium">Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
