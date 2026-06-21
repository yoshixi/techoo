import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { WeekDayStrip } from '@/components/today/WeekDayStrip';

/** Week picker + optional context line (below global tab header). */
export function WeekPickerSection({
  selectedDay,
  onSelectDay,
  subtitle,
}: {
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  subtitle?: string;
}) {
  return (
    <View className="px-4 pb-1 pt-1">
      {subtitle ? (
        <Text className="mb-1.5 text-xs text-muted-foreground" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <WeekDayStrip selected={selectedDay} onSelectDay={onSelectDay} />
    </View>
  );
}
