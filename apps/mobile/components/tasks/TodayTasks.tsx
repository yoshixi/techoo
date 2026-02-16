import { View } from 'react-native';
import { Calendar } from 'lucide-react-native';
import type { Task, TaskTimer } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { TaskListItem } from './TaskListItem';

export interface TodayTasksProps {
  tasks: Task[];
  activeTimerByTaskId: Record<string, TaskTimer>;
  onTaskPress: (task: Task) => void;
}

export function TodayTasks({
  tasks,
  activeTimerByTaskId,
  onTaskPress,
}: TodayTasksProps) {
  // Sort by startAt time
  const sortedTasks = [...tasks].sort((a, b) => {
    const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
    const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
    return aTime - bTime;
  });

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <Calendar size={16} className="text-primary" />
        <Text className="font-semibold text-primary">Today</Text>
        <View className="bg-primary/20 px-2 py-0.5 rounded-full">
          <Text className="text-xs text-primary font-medium">{tasks.length}</Text>
        </View>
      </View>
      {sortedTasks.length > 0 ? (
        <View>
          {sortedTasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              activeTimer={activeTimerByTaskId[task.id]}
              onPress={() => onTaskPress(task)}
            />
          ))}
        </View>
      ) : (
        <View className="py-6 items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
          <Text className="text-muted-foreground text-sm">No tasks scheduled for today</Text>
          <Text className="text-muted-foreground text-xs mt-1">Use Quick Start or + to add one</Text>
        </View>
      )}
    </View>
  );
}
