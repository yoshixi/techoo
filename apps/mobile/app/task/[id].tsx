import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskDetailContent } from '@/components/tasks/TaskDetailContent';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <TaskDetailContent taskId={Number(id)} />
      </View>
    </SafeAreaView>
  );
}
