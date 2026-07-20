import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import type { CalendarEvent } from '@/gen/api/schemas';
import type { CalendarTimedItem } from '@/lib/todoCalendar';
import { Text } from '@/components/ui/text';
import { TaskBlock } from './TaskBlock';
import { EventBlock } from './EventBlock';
import { isToday } from '@/lib/time';
import { calculateTaskLayoutsForDay, calculateEventLayoutsForDay } from '@/lib/calendar-utils';

export interface TimeRange {
  startAt: Date;
  endAt: Date;
}

export interface DayColumnProps {
  date: Date;
  tasks: CalendarTimedItem[];
  events?: CalendarEvent[];
  calendarColorMap?: Record<string, string | null>;
  hourHeight: number;
  columnWidth: number;
  onTaskPress: (task: CalendarTimedItem) => void;
  onCreateRange?: (range: TimeRange) => void;
  onTaskMove?: (task: CalendarTimedItem, deltaMinutes: number) => void;
  showDayLabel?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_MINUTES = 15;
const DEFAULT_DURATION_MINUTES = 30;
const LONG_PRESS_MS = 400;

export function DayColumn({
  date,
  tasks,
  events = [],
  calendarColorMap = {},
  hourHeight,
  columnWidth,
  onTaskPress,
  onTaskMove,
  onCreateRange,
  showDayLabel = false,
}: DayColumnProps) {
  const today = isToday(date);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const taskLayouts = useMemo(
    () => calculateTaskLayoutsForDay(tasks, date, SLOT_MINUTES),
    [tasks, date]
  );

  const eventLayouts = useMemo(
    () => calculateEventLayoutsForDay(events, date, SLOT_MINUTES),
    [events, date]
  );

  const selectionTop = useSharedValue(0);
  const selectionHeight = useSharedValue(0);
  const selectionVisible = useSharedValue(0);

  const minutesToDate = useCallback(
    (minutes: number) => {
      const result = new Date(date);
      result.setHours(0, 0, 0, 0);
      result.setMinutes(minutes);
      return result;
    },
    [date]
  );

  const yToMinutes = useCallback(
    (y: number) => {
      const minutesPerPixel = 60 / hourHeight;
      const totalMinutes = y * minutesPerPixel;
      return Math.round(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    },
    [hourHeight]
  );

  const showSelectionPreview = useCallback(
    (y: number) => {
      const startMinutes = Math.max(
        0,
        Math.min(24 * 60 - DEFAULT_DURATION_MINUTES, yToMinutes(y))
      );
      selectionTop.value = (startMinutes / 60) * hourHeight;
      selectionHeight.value = (DEFAULT_DURATION_MINUTES / 60) * hourHeight;
      selectionVisible.value = 1;
    },
    [hourHeight, selectionHeight, selectionTop, selectionVisible, yToMinutes]
  );

  const hideSelectionPreview = useCallback(() => {
    selectionVisible.value = 0;
  }, [selectionVisible]);

  const handleCreateAt = useCallback(
    (y: number) => {
      if (!onCreateRange) return;
      const startMinutes = Math.max(
        0,
        Math.min(24 * 60 - DEFAULT_DURATION_MINUTES, yToMinutes(y))
      );
      onCreateRange({
        startAt: minutesToDate(startMinutes),
        endAt: minutesToDate(startMinutes + DEFAULT_DURATION_MINUTES),
      });
    },
    [minutesToDate, onCreateRange, yToMinutes]
  );

  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_MS)
    .maxDistance(16)
    .shouldCancelWhenOutside(false)
    .onStart((event) => {
      'worklet';
      runOnJS(showSelectionPreview)(event.y);
    })
    .onEnd((event, success) => {
      'worklet';
      runOnJS(hideSelectionPreview)();
      if (!success) return;
      runOnJS(handleCreateAt)(event.y);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(hideSelectionPreview)();
    });

  const selectionAnimatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 2,
    right: 2,
    top: selectionTop.value,
    height: selectionHeight.value,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    opacity: selectionVisible.value,
  }));

  return (
    <View style={{ width: columnWidth }} className="border-l border-border">
      {showDayLabel && (
        <View
          className={`h-10 items-center justify-center border-b border-border ${
            today ? 'bg-primary/10' : ''
          }`}
        >
          <Text className={`text-xs ${today ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
            {dayNames[date.getDay()]}
          </Text>
          <Text className={`text-sm ${today ? 'font-bold text-primary' : ''}`}>{date.getDate()}</Text>
        </View>
      )}

      <GestureDetector gesture={longPressGesture}>
        <Animated.View className="relative">
          {HOURS.map((hour) => (
            <View
              key={hour}
              style={{ height: hourHeight }}
              className="border-b border-border/30"
            />
          ))}

          <Animated.View style={selectionAnimatedStyle} pointerEvents="none" />

          {eventLayouts.map((layout) => {
            const { event, startDate: evStart, endDate: evEnd, lane, laneCount } = layout;
            const evStartMinutes = evStart.getHours() * 60 + evStart.getMinutes();
            const evTop = (evStartMinutes / 60) * hourHeight;
            const evDuration = (evEnd.getTime() - evStart.getTime()) / 60000;
            const evHeight = (evDuration / 60) * hourHeight;

            const availableWidth = columnWidth - 4;
            const evLaneWidth = availableWidth / laneCount;
            const evLeft = 2 + lane * evLaneWidth;

            return (
              <EventBlock
                key={`event-${event.id}`}
                event={event}
                top={evTop}
                height={Math.max(evHeight, 20)}
                width={evLaneWidth - 2}
                left={evLeft}
                calendarColor={calendarColorMap[event.calendarId]}
              />
            );
          })}

          {taskLayouts.map((layout) => {
            const { task, startDate, endDate, lane, laneCount } = layout;
            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const top = (startMinutes / 60) * hourHeight;
            const duration = (endDate.getTime() - startDate.getTime()) / 60000;
            const height = (duration / 60) * hourHeight;
            const isActive = false;
            const isCompleted = task.done === 1;

            const availableWidth = columnWidth - 4;
            const laneWidth = availableWidth / laneCount;
            const left = 2 + lane * laneWidth;

            return (
              <TaskBlock
                key={task.id}
                task={task}
                top={top}
                height={Math.max(height, 30)}
                width={laneWidth - 2}
                left={left}
                hourHeight={hourHeight}
                isActive={isActive}
                isCompleted={isCompleted}
                onPress={() => onTaskPress(task)}
                onMove={onTaskMove}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
