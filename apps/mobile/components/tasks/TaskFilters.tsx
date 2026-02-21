import { View, Pressable } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

export interface FilterState {
  showCompleted: boolean;
  selectedTagIds: number[];
}

export interface SortState {
  sortBy: 'startAt' | 'createdAt' | 'dueDate';
  order: 'asc' | 'desc';
}

export interface TaskFilterButtonProps {
  filters: FilterState;
  sort: SortState;
  onPress: () => void;
}

/** Check if any non-default filters are active */
export function hasActiveFilters(filters: FilterState, sort: SortState): boolean {
  return (
    filters.showCompleted ||
    filters.selectedTagIds.length > 0 ||
    sort.sortBy !== 'startAt' ||
    sort.order !== 'asc'
  );
}

export function TaskFilterButton({
  filters,
  sort,
  onPress,
}: TaskFilterButtonProps) {
  const isActive = hasActiveFilters(filters, sort);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      className="relative p-2"
    >
      <SlidersHorizontal
        size={20}
        className={isActive ? 'text-primary' : 'text-muted-foreground'}
      />
      {isActive && (
        <View className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </Pressable>
  );
}
