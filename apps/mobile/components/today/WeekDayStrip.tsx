import { View, Pressable, ScrollView } from 'react-native'
import { Text } from '@/components/ui/text'
import { isSameLocalDay, startOfLocalDay, startOfWeekSunday } from '@/lib/dayBounds'
import { addDays } from '@/lib/time'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

export function WeekDayStrip({
  selected,
  onSelectDay,
}: {
  selected: Date
  onSelectDay: (d: Date) => void
}) {
  const weekStart = startOfWeekSunday(selected)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = startOfLocalDay(new Date())

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
      <View className="flex-row gap-1.5 px-1">
        {days.map((d, i) => {
          const sel = isSameLocalDay(d, selected)
          const isToday = isSameLocalDay(d, today)
          return (
            <Pressable
              key={i}
              onPress={() => onSelectDay(startOfLocalDay(d))}
              className={`min-w-[44px] items-center rounded-xl border px-2 py-2 ${
                sel ? 'border-primary/35 bg-primary/10' : 'border-transparent bg-card/65'
              }`}
            >
              <Text className={`text-[10px] font-medium uppercase ${sel ? 'text-primary' : 'text-muted-foreground'}`}>
                {DOW[d.getDay()]}
              </Text>
              <Text className={`mt-0.5 text-sm font-semibold ${sel ? 'text-primary' : 'text-foreground'}`}>
                {d.getDate()}
              </Text>
              {isToday ? (
                <View className="mt-1 h-1 w-1 rounded-full bg-amber-500" />
              ) : (
                <View className="mt-1 h-1 w-1" />
              )}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
