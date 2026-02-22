import { View } from 'react-native';
import type { Task, TaskTimer } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { TaskListItem } from './TaskListItem';

export interface InProgressSectionProps {
  tasks: Task[];
  activeTimerByTaskId: Record<string, TaskTimer>;
  onTaskPress: (task: Task) => void;
}

export function InProgressSection({
  tasks,
  activeTimerByTaskId,
  onTaskPress,
}: InProgressSectionProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="h-2 w-2 rounded-full bg-green-700" />
        <Text className="font-semibold text-sm">Focusing Now</Text>
      </View>
      {tasks.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          activeTimer={activeTimerByTaskId[task.id]}
          onPress={() => onTaskPress(task)}
        />
      ))}
    </View>
  );
}
