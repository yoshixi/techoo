import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { WeekDayStrip } from '@/components/today/WeekDayStrip';

export function WeeklyTabHeader({
  title,
  selectedDay,
  onSelectDay,
}: {
  title: string;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
}) {
  const router = useRouter();
  const dayLabel = selectedDay.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View className="px-4 pt-1 pb-1">
      <View className="mb-2 flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-2xl font-semibold text-foreground">{title}</Text>
          <Text className="mt-1 text-xs text-muted-foreground">{dayLabel}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
        >
          <Settings size={18} className="text-foreground" />
        </Pressable>
      </View>
      <WeekDayStrip selected={selectedDay} onSelectDay={onSelectDay} />
    </View>
  );
}
