import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { WeekDayStrip } from '@/components/today/WeekDayStrip';
import { TodosViewSegment } from '@/components/todos/TodosViewSegment';
import type { TodosViewMode } from '@/lib/todosScreenIntent';

/** ToDos-specific controls below the global tab header. */
export function TodosScreenHeader({
  selectedDay,
  onSelectDay,
  viewMode,
  onViewModeChange,
  subtitle,
}: {
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  viewMode: TodosViewMode;
  onViewModeChange: (mode: TodosViewMode) => void;
  subtitle: string;
}) {
  return (
    <View className="px-4 pb-1 pt-1">
      <TodosViewSegment value={viewMode} onChange={onViewModeChange} />
      <Text className="mb-1.5 mt-1.5 text-xs text-muted-foreground" numberOfLines={1}>
        {subtitle}
      </Text>
      {viewMode === 'timeline' ? (
        <WeekDayStrip selected={selectedDay} onSelectDay={onSelectDay} />
      ) : null}
    </View>
  );
}
