import * as React from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<PressableProps, 'onPress'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Switch({ checked, onCheckedChange, disabled = false, className, ...props }: SwitchProps) {
  const translateX = useSharedValue(checked ? 20 : 0);

  React.useEffect(() => {
    translateX.value = withTiming(checked ? 20 : 0, { duration: 200 });
  }, [checked, translateX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={cn(
        'h-6 w-11 rounded-full p-0.5',
        checked ? 'bg-primary' : 'bg-input',
        disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      <Animated.View
        style={thumbStyle}
        className="h-5 w-5 rounded-full bg-background"
      />
    </Pressable>
  );
}

export { Switch };
