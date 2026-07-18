import { View, Pressable, Text as RNText, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';

export function TodoUndoToast({
  title,
  onUndo,
  bottomInset,
}: {
  title: string;
  onUndo: () => void;
  bottomInset: number;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const bottom = Math.max(bottomInset + 14, 24);
  const maxToastWidth = Math.round(screenWidth * 0.78);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        bottom,
        maxWidth: maxToastWidth,
      }}
    >
      <View className="self-start rounded-xl border border-border/50 bg-card px-2.5 py-2 shadow-sm">
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
          <View className="h-6 w-6 items-center justify-center rounded-full border border-amber-700/30 bg-amber-600">
            <Check size={12} color="#FFF7ED" strokeWidth={2.25} />
          </View>
          <RNText
            style={{ flexShrink: 0, fontSize: 14, fontWeight: '500', lineHeight: 20 }}
            className="text-foreground"
          >
            {title}
          </RNText>
        </View>
        <Pressable onPress={onUndo} hitSlop={8} className="mt-1.5 self-start">
          <Text className="text-sm font-semibold text-amber-600">Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}
