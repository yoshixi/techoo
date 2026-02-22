import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Play, Square } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import type { TaskTimer } from '@/gen/api/schemas';
import {
  usePostApiTimers,
  putApiTimersId,
  getGetApiTasksTaskIdTimersKey,
  getGetApiTimersKey,
} from '@/gen/api/endpoints/comoriAPI.gen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export interface TimerControlsProps {
  taskId: number;
  activeTimer?: TaskTimer;
}

export function TimerControls({ taskId, activeTimer }: TimerControlsProps) {
  const { mutate } = useSWRConfig();
  const { trigger: createTimer, isMutating: isStarting } = usePostApiTimers();
  const [isStopping, setIsStopping] = useState(false);

  const handleStart = useCallback(async () => {
    await createTimer({
      taskId,
      startTime: new Date().toISOString(),
    });
    await mutate(getGetApiTasksTaskIdTimersKey(taskId));
    await mutate(getGetApiTimersKey());
  }, [taskId, createTimer, mutate]);

  const handleStop = useCallback(async () => {
    if (!activeTimer) return;
    setIsStopping(true);
    try {
      await putApiTimersId(activeTimer.id, { endTime: new Date().toISOString() });
      await mutate(getGetApiTasksTaskIdTimersKey(taskId));
      await mutate(getGetApiTimersKey());
    } finally {
      setIsStopping(false);
    }
  }, [activeTimer, taskId, mutate]);

  const isRunning = !!activeTimer && !activeTimer.endTime;

  return (
    <View className="flex-row justify-center gap-4">
      {isRunning ? (
        <Button
          onPress={handleStop}
          variant="destructive"
          disabled={isStopping}
          className="flex-row items-center gap-2 px-6"
        >
          <Square size={16} color="white" fill="white" />
          <Text className="text-destructive-foreground font-medium">
            {isStopping ? 'Stopping...' : 'Stop'}
          </Text>
        </Button>
      ) : (
        <Button
          onPress={handleStart}
          disabled={isStarting}
          className="flex-row items-center gap-2 px-6"
        >
          <Play size={16} color="white" fill="white" />
          <Text className="text-primary-foreground font-medium">
            {isStarting ? 'Starting...' : 'Start Timer'}
          </Text>
        </Button>
      )}
    </View>
  );
}
