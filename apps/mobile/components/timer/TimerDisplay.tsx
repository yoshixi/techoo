import { View } from 'react-native';
import type { TaskTimer } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { useTimer } from '@/hooks/useTimer';

export interface TimerDisplayProps {
  taskId: number;
  activeTimer?: TaskTimer;
}

export function TimerDisplay({ activeTimer }: TimerDisplayProps) {
  const { formattedTime, isRunning } = useTimer({
    startTime: activeTimer?.startTime,
    isActive: !!activeTimer && !activeTimer.endTime,
  });

  return (
    <View className="items-center py-4">
      <Text
        className={`text-4xl font-mono font-bold ${
          isRunning ? 'text-green-600 dark:text-green-400' : 'text-foreground'
        }`}
      >
        {formattedTime}
      </Text>
      {isRunning && (
        <View className="flex-row items-center gap-2 mt-2">
          <View className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <Text className="text-sm text-muted-foreground">Timer running</Text>
        </View>
      )}
    </View>
  );
}
