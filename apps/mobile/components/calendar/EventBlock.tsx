import { View } from 'react-native'
import type { CalendarEvent, Calendar } from '@/gen/api/schemas'
import { Text } from '@/components/ui/text'

export interface EventBlockProps {
  event: CalendarEvent
  top: number
  height: number
  width: number
  left?: number
  calendarColor?: string | null
}

export function EventBlock({
  event,
  top,
  height,
  width,
  left = 2,
  calendarColor,
}: EventBlockProps) {
  const color = calendarColor || '#4285F4'

  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        height,
        width,
        backgroundColor: `${color}30`,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color }}
        numberOfLines={height > 40 ? 2 : 1}
      >
        {event.title}
      </Text>
      {height > 40 && (
        <Text className="text-xs opacity-70" style={{ color }} numberOfLines={1}>
          {formatEventTime(event)}
        </Text>
      )}
    </View>
  )
}

function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.startAt)
  const end = new Date(event.endAt)
  const fmt = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return `${fmt(start)} - ${fmt(end)}`
}
