import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskList } from '@/components/tasks/TaskList';

export default function TasksScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <View className="flex-1">
        <TaskList />
      </View>
    </SafeAreaView>
  );
}
