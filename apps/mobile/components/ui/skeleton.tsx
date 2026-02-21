import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends ViewProps {
  width?: number;
  height?: number;
  circle?: boolean;
}

function Skeleton({ className, width, height, circle, style, ...props }: SkeletonProps) {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 1000 }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        { width, height },
        circle && { borderRadius: 9999 },
        style,
      ]}
      className={cn('rounded-md bg-muted', className)}
      {...props}
    />
  );
}

function SkeletonText({ className, ...props }: ViewProps) {
  return <Skeleton className={cn('h-4 w-full', className)} {...props} />;
}

function SkeletonCard({ className, ...props }: ViewProps) {
  return (
    <View className={cn('rounded-lg border border-border bg-card p-4', className)} {...props}>
      <Skeleton className="mb-4 h-6 w-3/4" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </View>
  );
}

export { Skeleton, SkeletonText, SkeletonCard };
