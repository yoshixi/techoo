import { View, Pressable } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { isSameLocalDay, startOfLocalDay, startOfWeekSunday } from '@/lib/dayBounds'
import { addDays } from '@/lib/time'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

function WeekChevron({
  direction,
  onPress,
}: {
  direction: 'prev' | 'next'
  onPress: () => void
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'prev' ? 'Previous week' : 'Next week'}
      className="shrink-0 items-center justify-center px-0.5 py-1 active:opacity-50"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Icon size={22} className="text-muted-foreground/75" strokeWidth={2.25} />
    </Pressable>
  )
}

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

  const shiftWeek = (delta: number) => {
    onSelectDay(startOfLocalDay(addDays(selected, delta * 7)))
  }

  return (
    <View className="mb-2 flex-row items-center gap-1">
      <WeekChevron direction="prev" onPress={() => shiftWeek(-1)} />
      <View className="min-w-0 flex-1 flex-row gap-1">
        {days.map((d, i) => {
          const sel = isSameLocalDay(d, selected)
          const isToday = isSameLocalDay(d, today)
          return (
            <Pressable
              key={i}
              onPress={() => onSelectDay(startOfLocalDay(d))}
              className={`min-w-0 flex-1 items-center rounded-xl border px-0.5 py-2 ${
                sel ? 'border-primary/35 bg-primary/10' : 'border-transparent bg-card/65'
              }`}
            >
              <Text
                className={`text-[10px] font-medium uppercase ${sel ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {DOW[d.getDay()]}
              </Text>
              <Text className={`mt-0.5 text-sm font-semibold tabular-nums ${sel ? 'text-primary' : 'text-foreground'}`}>
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
      <WeekChevron direction="next" onPress={() => shiftWeek(1)} />
    </View>
  )
}
