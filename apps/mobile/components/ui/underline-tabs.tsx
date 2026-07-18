import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';

export function UnderlineTabRow<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  equalWidth = true,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
  equalWidth?: boolean;
}) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className={`flex-row border-b border-border/30 ${equalWidth ? '' : 'gap-1'}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={equalWidth ? { flex: 1 } : undefined}
            className={`items-center px-1 pb-2 pt-0.5 ${equalWidth ? '' : 'min-w-[4.5rem]'}`}
          >
            <Text
              className={`${textSize} font-semibold ${active ? 'text-foreground' : 'text-muted-foreground'}`}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            <View
              className={`mt-1.5 h-0.5 w-full rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
