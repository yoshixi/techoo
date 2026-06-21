import { View, Pressable } from 'react-native';
import { Check, Clock } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import type { Todo } from '@/gen/api/schemas';
import { formatTodoClockTime, formatTime } from '@/lib/time';

function scheduleSubtitle(todo: Todo): string {
  if (todo.done === 1) {
    const doneLabel = todo.done_at != null ? `Completed ${formatTime(todo.done_at)}` : 'Completed';
    if (todo.is_all_day === 1) return `${doneLabel} · All day`;
    if (todo.starts_at == null) return `${doneLabel} · Later`;
    if (todo.ends_at != null) {
      return `${doneLabel} · Was ${formatTodoClockTime(todo.starts_at)} – ${formatTodoClockTime(todo.ends_at)}`;
    }
    return `${doneLabel} · Was ${formatTodoClockTime(todo.starts_at!)}`;
  }
  if (todo.is_all_day === 1) return 'All day';
  if (todo.starts_at == null) return 'No time';
  if (todo.ends_at != null) {
    return `${formatTodoClockTime(todo.starts_at)} – ${formatTodoClockTime(todo.ends_at)}`;
  }
  return formatTodoClockTime(todo.starts_at);
}

/** List row — matches timed todo cards on the Schedule tab. */
export function TodoListRow({
  todo,
  onPress,
  onToggleDone,
}: {
  todo: Todo;
  onPress: () => void;
  onToggleDone: () => void;
}) {
  const isDone = todo.done === 1;
  const checkSize = todo.is_all_day === 1 ? 'h-9 w-9' : 'h-8 w-8';
  const checkIcon = todo.is_all_day === 1 ? 18 : 16;

  return (
    <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-card/60 px-3 py-3 active:opacity-80">
      <Pressable
        onPress={onToggleDone}
        className={`${checkSize} items-center justify-center rounded-full bg-muted/70`}
      >
        {isDone ? <Check size={checkIcon} className="text-green-600" /> : null}
      </Pressable>
      <Pressable onPress={onPress} className="min-w-0 flex-1">
        <Text className={`text-sm ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {todo.title}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Clock size={11} className="text-muted-foreground" />
          <Text className="text-[11px] tabular-nums text-muted-foreground">{scheduleSubtitle(todo)}</Text>
        </View>
      </Pressable>
    </View>
  );
}
