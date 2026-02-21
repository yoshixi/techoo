import * as React from 'react';
import { View, type ViewProps, Pressable, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

const badgeVariants = cva(
  'flex flex-row items-center rounded-full px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  label: string;
}

function Badge({ className, variant, label, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      <Text className={cn(badgeTextVariants({ variant }))}>{label}</Text>
    </View>
  );
}

export interface PressableBadgeProps
  extends PressableProps,
    VariantProps<typeof badgeVariants> {
  label: string;
}

function PressableBadge({
  className,
  variant,
  label,
  ...props
}: PressableBadgeProps) {
  return (
    <Pressable
      className={cn(badgeVariants({ variant }), 'active:opacity-70', className)}
      {...props}
    >
      <Text className={cn(badgeTextVariants({ variant }))}>{label}</Text>
    </Pressable>
  );
}

export { Badge, PressableBadge, badgeVariants };
