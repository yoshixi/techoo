import { View, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import type { ViewMode } from './CalendarView';
import { formatDate, isToday } from '@/lib/time';

export interface CalendarHeaderProps {
  selectedDate: Date;
  viewMode: ViewMode;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleViewMode: () => void;
}

export function CalendarHeader({
  selectedDate,
  viewMode,
  onPrevious,
  onNext,
  onToday,
  onToggleViewMode,
}: CalendarHeaderProps) {
  const dateLabel =
    viewMode === 'day'
      ? formatDate(selectedDate)
      : `Week of ${formatDate(selectedDate)}`;

  return (
    <View className="px-4 py-3 border-b border-border">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onPrevious}
            className="p-2 rounded-full active:bg-muted"
            hitSlop={10}
          >
            <ChevronLeft size={20} className="text-foreground" />
          </Pressable>

          <Text className="font-semibold text-lg min-w-[150px] text-center">
            {dateLabel}
          </Text>

          <Pressable
            onPress={onNext}
            className="p-2 rounded-full active:bg-muted"
            hitSlop={10}
          >
            <ChevronRight size={20} className="text-foreground" />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          {!isToday(selectedDate) && (
            <Pressable
              onPress={onToday}
              className="px-3 py-1.5 bg-muted rounded-full"
            >
              <Text className="text-sm">Today</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-2">
        <Pressable
          onPress={onToggleViewMode}
          className={`px-3 py-1.5 rounded-full ${
            viewMode === 'day' ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <Text
            className={`text-sm ${
              viewMode === 'day' ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            Day
          </Text>
        </Pressable>
        <Pressable
          onPress={onToggleViewMode}
          className={`px-3 py-1.5 rounded-full ${
            viewMode === 'week' ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <Text
            className={`text-sm ${
              viewMode === 'week' ? 'text-primary-foreground' : 'text-foreground'
            }`}
          >
            Week
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
