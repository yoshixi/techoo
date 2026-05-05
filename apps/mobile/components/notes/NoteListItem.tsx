import { useCallback, useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Pin, Trash2 } from 'lucide-react-native';
import type { Note } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { getRelativeTime } from '@/lib/time';

const FADE_OUT_DURATION = 300;

export interface NoteListItemProps {
  note: Note;
  onPress: () => void;
  onDelete: (noteId: number) => Promise<void>;
  onTogglePin: (noteId: number, pinned: number) => Promise<void>;
}

export function NoteListItem({ note, onPress, onDelete, onTogglePin }: NoteListItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const [isHiding, setIsHiding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;

  const animateOut = useCallback(
    (action: () => Promise<void>) => {
      swipeableRef.current?.close();
      setIsHiding(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: FADE_OUT_DURATION, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: 0, duration: FADE_OUT_DURATION, useNativeDriver: false }),
      ]).start(() => {
        void Promise.resolve(action()).catch(() => {});
      });
    },
    [fadeAnim, heightAnim]
  );

  const handleDelete = useCallback(() => {
    animateOut(() => onDelete(note.id));
  }, [animateOut, onDelete, note.id]);

  const handlePin = useCallback(() => {
    swipeableRef.current?.close();
    const next = note.pinned === 1 ? 0 : 1;
    void onTogglePin(note.id, next).catch(() => {});
  }, [note.id, note.pinned, onTogglePin]);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View className="mb-2 flex-row">
        <Pressable
          onPress={handlePin}
          className="mr-1 items-center justify-center rounded-lg bg-amber-500 px-4"
        >
          <Animated.View style={{ transform: [{ scale }] }} className="items-center">
            <Pin size={22} color="white" />
            <Text className="mt-1 text-xs font-medium text-white">{note.pinned ? 'Unpin' : 'Pin'}</Text>
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          className="items-center justify-center rounded-lg bg-destructive px-4"
        >
          <Animated.View style={{ transform: [{ scale }] }} className="items-center">
            <Trash2 size={22} color="white" />
            <Text className="mt-1 text-xs font-medium text-white">Delete</Text>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scaleY: heightAnim }],
        marginBottom: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        enabled={!isHiding}
      >
        <Pressable
          onPress={onPress}
          disabled={isHiding}
          className="mb-2 rounded-lg border border-border bg-card px-3 py-3 active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            {note.pinned === 1 ? <Pin size={14} className="text-amber-600" /> : null}
            <Text className="flex-1 font-medium" numberOfLines={1}>
              {note.title}
            </Text>
          </View>
          {note.body ? (
            <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
              {note.body}
            </Text>
          ) : null}
          <Text className="mt-2 text-xs text-muted-foreground">
            {getRelativeTime(note.updated_at)}
          </Text>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}
