import { View } from 'react-native';
import { Clock, MessageSquare } from 'lucide-react-native';
import { useGetApiTasksIdActivities } from '@/gen/api/endpoints/shuchuAPI.gen';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatElapsedTime, calculateDurationSeconds } from '@/lib/time';

export interface ActivityTimelineProps {
  taskId: number;
}

export function ActivityTimeline({ taskId }: ActivityTimelineProps) {
  const { data, isLoading } = useGetApiTasksIdActivities(taskId);
  const activities = data?.activities ?? [];

  if (isLoading) {
    return (
      <View className="gap-2">
        <Skeleton className="h-12 w-full rounded" />
        <Skeleton className="h-12 w-full rounded" />
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-sm text-muted-foreground">No activity yet</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {activities.map((activity, index) => {
        if (activity.type === 'timer') {
          const timer = activity.data;
          const duration = timer.endTime
            ? calculateDurationSeconds(timer.startTime, timer.endTime)
            : 0;
          const isActive = !timer.endTime;

          return (
            <View
              key={`timer-${timer.id}`}
              className="flex-row items-start gap-3 py-2 px-3 bg-muted/30 rounded"
            >
              <View
                className={`h-8 w-8 rounded-full items-center justify-center ${
                  isActive ? 'bg-green-200 dark:bg-green-900' : 'bg-muted'
                }`}
              >
                <Clock
                  size={14}
                  className={isActive ? 'text-green-700' : 'text-muted-foreground'}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium">
                  {isActive ? 'Timer started' : 'Timer session'}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {formatDateTime(timer.startTime)}
                  {timer.endTime && ` · ${formatElapsedTime(duration)}`}
                </Text>
              </View>
            </View>
          );
        }

        if (activity.type === 'comment') {
          const comment = activity.data;
          return (
            <View
              key={`comment-${comment.id}`}
              className="flex-row items-start gap-3 py-2 px-3 bg-muted/30 rounded"
            >
              <View className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center">
                <MessageSquare size={14} className="text-blue-600 dark:text-blue-400" />
              </View>
              <View className="flex-1">
                <Text className="text-sm" numberOfLines={2}>
                  {comment.body}
                </Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(comment.createdAt)}
                </Text>
              </View>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}
