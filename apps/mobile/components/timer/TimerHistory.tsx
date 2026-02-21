import { View } from 'react-native';
import { Clock } from 'lucide-react-native';
import type { TaskTimer } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatElapsedTime, calculateDurationSeconds } from '@/lib/time';

export interface TimerHistoryProps {
  timers: TaskTimer[];
}

export function TimerHistory({ timers }: TimerHistoryProps) {
  const completedTimers = timers.filter((t) => t.endTime);

  if (completedTimers.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-sm text-muted-foreground">No completed sessions yet</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {completedTimers.map((timer) => {
        const duration = calculateDurationSeconds(timer.startTime, timer.endTime!);
        return (
          <View
            key={timer.id}
            className="flex-row items-center justify-between py-2 px-3 bg-muted/30 rounded"
          >
            <View className="flex-row items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <Text className="text-sm">{formatDateTime(timer.startTime)}</Text>
            </View>
            <Text className="text-sm font-mono font-medium">
              {formatElapsedTime(duration)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
