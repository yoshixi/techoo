import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarView } from '@/components/calendar/CalendarView';

export default function CalendarScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <View className="flex-1">
        <CalendarView />
      </View>
    </SafeAreaView>
  );
}
