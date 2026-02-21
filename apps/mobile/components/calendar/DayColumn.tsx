import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import type { Task, CalendarEvent } from '@/gen/api/schemas';
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
  tasks: Task[];
  events?: CalendarEvent[];
  calendarColorMap?: Record<string, string | null>;
  activeTimerTaskIds: Set<number>;
  hourHeight: number;
  columnWidth: number;
  onTaskPress: (task: Task) => void;
  onCreateRange?: (range: TimeRange) => void;
  onTaskMove?: (task: Task, deltaMinutes: number) => void;
  showDayLabel?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_MINUTES = 15; // 15-minute increments

export function DayColumn({
  date,
  tasks,
  events = [],
  calendarColorMap = {},
  activeTimerTaskIds,
  hourHeight,
  columnWidth,
  onTaskPress,
  onTaskMove,
  onCreateRange,
  showDayLabel = false,
}: DayColumnProps) {
  const today = isToday(date);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate task layouts with lane assignments for overlapping tasks
  const taskLayouts = useMemo(
    () => calculateTaskLayoutsForDay(tasks, date, SLOT_MINUTES),
    [tasks, date]
  );

  // Calculate event layouts
  const eventLayouts = useMemo(
    () => calculateEventLayoutsForDay(events, date, SLOT_MINUTES),
    [events, date]
  );

  // Shared values for drag selection
  const isDragging = useSharedValue(false);
  const startY = useSharedValue(0);
  const currentY = useSharedValue(0);
  const selectionTop = useSharedValue(0);
  const selectionHeight = useSharedValue(0);

  const yToMinutes = useCallback(
    (y: number) => {
      const minutesPerPixel = 60 / hourHeight;
      const totalMinutes = y * minutesPerPixel;
      // Snap to 15-minute increments
      return Math.round(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES;
    },
    [hourHeight]
  );

  const minutesToDate = useCallback(
    (minutes: number) => {
      const result = new Date(date);
      result.setHours(0, 0, 0, 0);
      result.setMinutes(minutes);
      return result;
    },
    [date]
  );

  // Convert Y position to minutes (worklet-compatible version)
  const yToMinutesWorklet = (y: number) => {
    'worklet';
    const minutesPerPixel = 60 / hourHeight;
    const totalMinutes = y * minutesPerPixel;
    return Math.round(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  };

  const handleCreateRange = useCallback(
    (startMinutes: number, endMinutes: number) => {
      if (!onCreateRange) return;

      const minMinutes = Math.min(startMinutes, endMinutes);
      const maxMinutes = Math.max(startMinutes, endMinutes);

      // Ensure minimum duration of 30 minutes for better usability
      const actualEnd = maxMinutes <= minMinutes ? minMinutes + 30 : maxMinutes;

      onCreateRange({
        startAt: minutesToDate(minMinutes),
        endAt: minutesToDate(actualEnd),
      });
    },
    [onCreateRange, minutesToDate]
  );

  // Long press initiates drag selection for custom time range
  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart((event) => {
      'worklet';
      isDragging.value = true;
      startY.value = event.y;
      currentY.value = event.y;
      const startMinutes = yToMinutesWorklet(event.y);
      selectionTop.value = (startMinutes / 60) * hourHeight;
      selectionHeight.value = (SLOT_MINUTES / 60) * hourHeight;
    })
    .onEnd((event, success) => {
      'worklet';
      // If long press completed without dragging, create a 30-min task
      if (success && isDragging.value && Math.abs(startY.value - currentY.value) < 5) {
        const startMinutes = yToMinutesWorklet(event.y);
        runOnJS(handleCreateRange)(startMinutes, startMinutes + 30);
      }
      isDragging.value = false;
      selectionHeight.value = 0;
    });

  // Pan gesture for drag selection (only active after long press)
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onUpdate((event) => {
      'worklet';
      if (!isDragging.value) return;
      currentY.value = event.y;

      const startMinutes = yToMinutesWorklet(startY.value);
      const currentMinutes = yToMinutesWorklet(event.y);

      const minMinutes = Math.min(startMinutes, currentMinutes);
      const maxMinutes = Math.max(startMinutes, currentMinutes);

      selectionTop.value = (minMinutes / 60) * hourHeight;
      selectionHeight.value = Math.max(
        ((maxMinutes - minMinutes + SLOT_MINUTES) / 60) * hourHeight,
        (SLOT_MINUTES / 60) * hourHeight
      );
    })
    .onEnd(() => {
      'worklet';
      if (isDragging.value) {
        const startMinutes = yToMinutesWorklet(startY.value);
        const endMinutes = yToMinutesWorklet(currentY.value);
        runOnJS(handleCreateRange)(startMinutes, endMinutes);
      }
      isDragging.value = false;
      selectionHeight.value = 0;
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
      selectionHeight.value = 0;
    });

  // Long press + optional drag for task creation
  // Tapping on tasks will work normally since we're not using a Tap gesture
  const composed = Gesture.Simultaneous(longPressGesture, panGesture);

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
    opacity: isDragging.value ? 1 : 0,
  }));

  return (
    <View style={{ width: columnWidth }} className="border-l border-border">
      {showDayLabel && (
        <View
          className={`h-10 items-center justify-center border-b border-border ${today ? 'bg-primary/10' : ''
            }`}
        >
          <Text className={`text-xs ${today ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
            {dayNames[date.getDay()]}
          </Text>
          <Text className={`text-sm ${today ? 'font-bold text-primary' : ''}`}>
            {date.getDate()}
          </Text>
        </View>
      )}

      <GestureDetector gesture={composed}>
        <Animated.View className="relative">
          {/* Hour grid lines */}
          {HOURS.map((hour) => (
            <View
              key={hour}
              style={{ height: hourHeight }}
              className="border-b border-border/30"
            />
          ))}

          {/* Selection preview */}
          <Animated.View style={selectionAnimatedStyle} pointerEvents="none" />

          {/* Event blocks from Google Calendar */}
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

          {/* Task blocks with lane-based layout for overlapping tasks */}
          {taskLayouts.map((layout) => {
            const { task, startDate, endDate, lane, laneCount } = layout;
            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const top = (startMinutes / 60) * hourHeight;
            const duration = (endDate.getTime() - startDate.getTime()) / 60000;
            const height = (duration / 60) * hourHeight;
            const isActive = activeTimerTaskIds.has(task.id);
            const isCompleted = !!task.completedAt;

            // Calculate width and left position based on lane assignment
            const availableWidth = columnWidth - 4; // 2px padding on each side
            const laneWidth = availableWidth / laneCount;
            const left = 2 + lane * laneWidth;

            return (
              <TaskBlock
                key={task.id}
                task={task}
                top={top}
                height={Math.max(height, 30)}
                width={laneWidth - 2} // 2px gap between lanes
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
