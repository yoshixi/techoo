import { View } from 'react-native';
import { CalendarView } from '@/components/calendar/CalendarView';

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-background">
      <CalendarView />
    </View>
  );
}
